import type { Express, Request, Response } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  hashPassword,
  validatePasswordInput,
  verifyPassword,
} from "./password.js";

export type AuthPrisma = Pick<
  PrismaClient,
  "requesterUser" | "session" | "$transaction"
>;

const COOKIE_NAME = "toktickit.sid";
const NORMAL_SESSION_MS = 8 * 60 * 60 * 1000;
const NORMAL_IDLE_MS = 30 * 60 * 1000;
const RESTRICTED_SESSION_MS = 15 * 60 * 1000;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const PAIR_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 30;
const PASSWORD_BODY_LIMIT = 16 * 1024;
const MAX_THROTTLE_BUCKETS = 10_000;

const INVALID_CREDENTIALS_MESSAGE =
  "Unable to sign in with those credentials. Check your details or contact an administrator.";
const SESSION_REQUIRED_MESSAGE =
  "An active authentication session is required.";
const CSRF_INVALID_MESSAGE = "Request origin or CSRF token is invalid.";

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  passwordHash: true,
  mustChangePassword: true,
  passwordChangedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const authSessionInclude = {
  user: { select: authUserSelect },
} as const;

type AuthUser = Prisma.RequesterUserGetPayload<{
  select: typeof authUserSelect;
}>;
type AuthSession = Prisma.SessionGetPayload<{
  include: typeof authSessionInclude;
}>;
type SessionContext = {
  session: AuthSession;
  token: string;
  tokenHash: string;
  restricted: boolean;
};
type Bucket = {
  count: number;
  startedAt: number;
};

const pairBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();
const dummyPasswordHash = [
  "scrypt-v1",
  "N=131072,r=8,p=1",
  Buffer.alloc(16).toString("base64url"),
  Buffer.alloc(64).toString("base64url"),
].join("$");

export function resetLoginThrottle() {
  pairBuckets.clear();
  ipBuckets.clear();
}

function noStore(res: Response) {
  res.setHeader("Cache-Control", "no-store");
}

function errorResponse(
  res: Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  noStore(res);
  const error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    correlationId?: string;
  } = { code, message };

  if (fieldErrors && Object.keys(fieldErrors).length) {
    error.fieldErrors = fieldErrors;
  }
  if (status >= 500) {
    error.correlationId = randomBytes(16).toString("hex");
  }
  return res.status(status).json({ error });
}

function configuredOrigin() {
  const value = process.env.CLIENT_ORIGIN?.trim();
  return value && /^https?:\/\/[^\s/]+(?::\d+)?$/.test(value) ? value : null;
}

function requireAllowedOrigin(req: Request, res: Response) {
  if (
    configuredOrigin() !== null &&
    req.header("Origin") === configuredOrigin()
  ) {
    return true;
  }
  errorResponse(res, 403, "CSRF_INVALID", CSRF_INVALID_MESSAGE);
  return false;
}

function isJson(req: Request) {
  return (
    (req.header("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase() ===
    "application/json"
  );
}

function withinLimit(req: Request) {
  const header = req.header("Content-Length");
  if (
    header &&
    /^\d+$/.test(header) &&
    Number(header) > PASSWORD_BODY_LIMIT
  ) {
    return false;
  }
  try {
    return (
      Buffer.byteLength(JSON.stringify(req.body ?? null), "utf8") <=
      PASSWORD_BODY_LIMIT
    );
  } catch {
    return false;
  }
}

function parseCookie(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

function https(req: Request) {
  return (
    req.secure ||
    req.protocol === "https" ||
    req.header("X-Forwarded-Proto")?.split(",", 1)[0].trim() === "https"
  );
}

function cookie(req: Request, token: string, maxAge: number) {
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    "Path=/api",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (https(req)) attributes.push("Secure");
  return attributes.join("; ");
}

function setCookie(
  res: Response,
  req: Request,
  token: string,
  restricted: boolean,
) {
  res.setHeader(
    "Set-Cookie",
    cookie(
      req,
      token,
      Math.floor(
        (restricted ? RESTRICTED_SESSION_MS : NORMAL_SESSION_MS) / 1000,
      ),
    ),
  );
}

function clearCookie(res: Response, req: Request) {
  const attributes = [
    `${COOKIE_NAME}=`,
    `Max-Age=0`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Path=/api`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (https(req)) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function ip(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function bucket(map: Map<string, Bucket>, key: string, now: number) {
  const current = map.get(key);
  if (!current || now - current.startedAt >= THROTTLE_WINDOW_MS) {
    const next = { count: 0, startedAt: now };
    map.set(key, next);
    return next;
  }
  return current;
}

function prune(map: Map<string, Bucket>, now: number) {
  for (const [key, value] of map) {
    if (now - value.startedAt >= THROTTLE_WINDOW_MS) map.delete(key);
  }
  if (map.size > MAX_THROTTLE_BUCKETS) {
    for (const [key] of [...map.entries()]
      .sort((a, b) => a[1].startedAt - b[1].startedAt)
      .slice(0, map.size - MAX_THROTTLE_BUCKETS)) {
      map.delete(key);
    }
  }
}

function retry(email: string, address: string, now: number) {
  prune(pairBuckets, now);
  prune(ipBuckets, now);
  const pair = bucket(pairBuckets, hashKey(`${email}\n${address}`), now);
  const ipBucket = bucket(ipBuckets, hashKey(address), now);
  const resetTimes: number[] = [];

  if (pair.count >= PAIR_FAILURE_LIMIT) {
    resetTimes.push(pair.startedAt + THROTTLE_WINDOW_MS);
  }
  if (ipBucket.count >= IP_FAILURE_LIMIT) {
    resetTimes.push(ipBucket.startedAt + THROTTLE_WINDOW_MS);
  }

  return resetTimes.length
    ? Math.max(1, Math.ceil((Math.max(...resetTimes) - now) / 1000))
    : null;
}

function failed(email: string, address: string, now: number) {
  prune(pairBuckets, now);
  prune(ipBuckets, now);
  bucket(pairBuckets, hashKey(`${email}\n${address}`), now).count++;
  bucket(ipBuckets, hashKey(address), now).count++;
}

function validEmail(value: string) {
  return (
    value.length >= 3 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function loginBody(body: unknown) {
  const errors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { e: { body: ["Request body must be a JSON object."] } };
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "email" && key !== "password") {
      errors[key] = ["This field is not supported."];
    }
  }

  const email =
    typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!validEmail(email)) errors.email = ["Enter a valid email address."];
  if (typeof record.password !== "string" || !password) {
    errors.password = ["Password is required."];
  } else if (
    Array.from(password).length > 128 ||
    Buffer.byteLength(password, "utf8") > 512
  ) {
    errors.password = [
      "Password must contain at most 128 characters and 512 UTF-8 bytes.",
    ];
  }

  return Object.keys(errors).length
    ? { e: errors }
    : { input: { email, password }, e: errors };
}

function changeBody(body: unknown) {
  const errors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { e: { body: ["Request body must be a JSON object."] } };
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["currentPassword", "newPassword", "confirmPassword"].includes(key)) {
      errors[key] = ["This field is not supported."];
    }
  }

  const currentPassword =
    typeof record.currentPassword === "string" ? record.currentPassword : "";
  const newPassword =
    typeof record.newPassword === "string" ? record.newPassword : "";
  const confirmPassword =
    typeof record.confirmPassword === "string" ? record.confirmPassword : "";

  if (!currentPassword) {
    errors.currentPassword = ["Current password is required."];
  }
  const passwordErrors = validatePasswordInput(newPassword);
  if (typeof record.newPassword !== "string" || passwordErrors.length) {
    errors.newPassword = passwordErrors.length
      ? passwordErrors
      : ["New password is required."];
  }
  if (!confirmPassword) {
    errors.confirmPassword = ["Confirm password is required."];
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = ["Passwords must match exactly."];
  }

  return Object.keys(errors).length
    ? { e: errors }
    : {
        input: { currentPassword, newPassword, confirmPassword },
        e: errors,
      };
}

function safe(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

function response(user: AuthUser, csrfToken: string) {
  return { user: safe(user), csrfToken };
}

function sessionValid(
  session: Pick<AuthSession, "expiresAt" | "lastSeenAt">,
  user: Pick<AuthUser, "isActive" | "mustChangePassword">,
  now: Date,
) {
  if (!user.isActive || now.getTime() >= session.expiresAt.getTime()) {
    return false;
  }
  return (
    user.mustChangePassword ||
    now.getTime() - session.lastSeenAt.getTime() < NORMAL_IDLE_MS
  );
}

async function load(
  prisma: AuthPrisma,
  req: Request,
  touch: boolean,
): Promise<SessionContext | null> {
  const token = parseCookie(req.header("Cookie"), COOKIE_NAME);
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: authSessionInclude,
  });
  if (!session) return null;

  const now = new Date();
  const restricted = session.user.mustChangePassword;
  if (!sessionValid(session, session.user, now)) return null;

  if (touch && !restricted) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  return { session, token, tokenHash, restricted };
}

function locks(
  tx: Prisma.TransactionClient,
  userId: number,
  sessionId: string,
) {
  if (typeof tx.$queryRaw !== "function") return [];
  return [
    tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    ),
    tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Session" WHERE "id" = CAST(${sessionId} AS uuid) FOR UPDATE`,
    ),
  ];
}

export function registerAuthRoutes(app: Express, prisma: AuthPrisma): void {
  app.post("/api/auth/login", async (req, res) => {
    noStore(res);
    if (!requireAllowedOrigin(req, res)) return;
    if (!isJson(req) || !withinLimit(req)) {
      return errorResponse(
        res,
        400,
        "VALIDATION_FAILED",
        "Please send a JSON login request within the allowed size.",
        { body: ["Login requests must be JSON and no larger than 16 KiB."] },
      );
    }

    const validation = loginBody(req.body);
    if (!validation.input) {
      return errorResponse(
        res,
        400,
        "VALIDATION_FAILED",
        "Please correct the highlighted fields.",
        validation.e,
      );
    }

    const address = ip(req);
    const wait = retry(validation.input.email, address, Date.now());
    if (wait !== null) {
      res.setHeader("Retry-After", String(wait));
      return errorResponse(
        res,
        429,
        "LOGIN_RATE_LIMITED",
        "Too many sign-in attempts. Please try again later.",
      );
    }

    let user: AuthUser | null = null;
    try {
      user = await prisma.requesterUser.findUnique({
        where: { email: validation.input.email },
        select: authUserSelect,
      });
    } catch {
      return errorResponse(
        res,
        500,
        "AUTH_LOGIN_FAILED",
        "Unable to sign in right now. Please try again.",
      );
    }

    const passwordMatches = await verifyPassword(
      validation.input.password,
      user?.passwordHash ?? dummyPasswordHash,
    );
    if (!user || !user.isActive || !user.passwordHash || !passwordMatches) {
      failed(validation.input.email, address, Date.now());
      return errorResponse(
        res,
        401,
        "INVALID_CREDENTIALS",
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    pairBuckets.delete(hashKey(`${validation.input.email}\n${address}`));
    const token = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("hex");
    const createdAt = new Date();
    const restricted = user.mustChangePassword;
    const expiresAt = new Date(
      createdAt.getTime() +
        (restricted ? RESTRICTED_SESSION_MS : NORMAL_SESSION_MS),
    );

    try {
      await prisma.$transaction(async (tx) => {
        const old = parseCookie(req.header("Cookie"), COOKIE_NAME);
        if (old) {
          await tx.session.deleteMany({
            where: { tokenHash: hashToken(old) },
          });
        }
        await tx.session.create({
          data: {
            tokenHash: hashToken(token),
            userId: user!.id,
            csrfToken,
            createdAt,
            lastSeenAt: createdAt,
            expiresAt,
          },
        });
      });
    } catch {
      return errorResponse(
        res,
        500,
        "AUTH_LOGIN_FAILED",
        "Unable to sign in right now. Please try again.",
      );
    }

    setCookie(res, req, token, restricted);
    return res.status(200).json(response(user, csrfToken));
  });

  app.get("/api/auth/me", async (req, res) => {
    noStore(res);
    try {
      const context = await load(prisma, req, true);
      if (!context) {
        clearCookie(res, req);
        return errorResponse(
          res,
          401,
          "SESSION_REQUIRED",
          SESSION_REQUIRED_MESSAGE,
        );
      }
      return res
        .status(200)
        .json(response(context.session.user, context.session.csrfToken));
    } catch {
      return errorResponse(
        res,
        500,
        "AUTH_SESSION_FAILED",
        "Unable to restore the authentication session.",
      );
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    noStore(res);
    let context: SessionContext | null;
    try {
      context = await load(prisma, req, false);
    } catch {
      return errorResponse(
        res,
        500,
        "AUTH_SESSION_FAILED",
        "Unable to restore the authentication session.",
      );
    }

    if (!context) {
      clearCookie(res, req);
      return errorResponse(
        res,
        401,
        "SESSION_REQUIRED",
        SESSION_REQUIRED_MESSAGE,
      );
    }
    if (!requireAllowedOrigin(req, res)) return;

    const csrf = req.header("X-CSRF-Token") ?? "";
    if (!equal(csrf, context.session.csrfToken)) {
      return errorResponse(res, 403, "CSRF_INVALID", CSRF_INVALID_MESSAGE);
    }
    if (!isJson(req) || !withinLimit(req)) {
      return errorResponse(
        res,
        400,
        "VALIDATION_FAILED",
        "Please send a JSON password request within the allowed size.",
        {
          body: ["Password requests must be JSON and no larger than 16 KiB."],
        },
      );
    }

    const validation = changeBody(req.body);
    if (!validation.input) {
      return errorResponse(
        res,
        400,
        "VALIDATION_FAILED",
        "Please correct the highlighted fields.",
        validation.e,
      );
    }

    const user = context.session.user;
    if (
      !user.passwordHash ||
      !(await verifyPassword(validation.input.currentPassword, user.passwordHash))
    ) {
      return errorResponse(
        res,
        401,
        "CURRENT_PASSWORD_INVALID",
        "The current password is incorrect.",
      );
    }
    if (
      validation.input.newPassword === validation.input.currentPassword ||
      (await verifyPassword(validation.input.newPassword, user.passwordHash))
    ) {
      return errorResponse(
        res,
        400,
        "VALIDATION_FAILED",
        "Please correct the highlighted fields.",
        { newPassword: ["New password must differ from the current password."] },
      );
    }

    let replacementHash: string;
    try {
      replacementHash = await hashPassword(validation.input.newPassword);
    } catch {
      return errorResponse(
        res,
        500,
        "PASSWORD_CHANGE_FAILED",
        "Unable to change the password.",
      );
    }

    const token = randomBytes(32).toString("base64url");
    const newCsrf = randomBytes(32).toString("hex");
    const at = new Date();
    const expiresAt = new Date(at.getTime() + NORMAL_SESSION_MS);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await Promise.all(locks(tx, user.id, context!.session.id));
        const latest = await tx.requesterUser.findUnique({
          where: { id: user.id },
          select: authUserSelect,
        });
        const session = await tx.session.findUnique({
          where: { id: context!.session.id },
          include: authSessionInclude,
        });

        if (
          !latest ||
          !session ||
          session.user.id !== user.id ||
          session.tokenHash !== context!.tokenHash ||
          session.csrfToken !== context!.session.csrfToken ||
          latest.version !== user.version ||
          latest.passwordHash !== user.passwordHash ||
          !sessionValid(session, latest, at)
        ) {
          throw new Error("VERSION_CONFLICT");
        }

        const result = await tx.requesterUser.updateMany({
          where: {
            id: user.id,
            version: user.version,
            passwordHash: user.passwordHash,
          },
          data: {
            passwordHash: replacementHash,
            mustChangePassword: false,
            passwordChangedAt: at,
            version: { increment: 1 },
            updatedAt: at,
          },
        });
        if (result.count !== 1) throw new Error("VERSION_CONFLICT");

        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.session.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            csrfToken: newCsrf,
            createdAt: at,
            lastSeenAt: at,
            expiresAt,
          },
        });

        return {
          ...latest,
          passwordHash: replacementHash,
          mustChangePassword: false,
          passwordChangedAt: at,
          version: latest.version + 1,
          updatedAt: at,
        };
      });

      setCookie(res, req, token, false);
      return res.status(200).json(response(updated, newCsrf));
    } catch (error) {
      if (error instanceof Error && error.message === "VERSION_CONFLICT") {
        return errorResponse(
          res,
          409,
          "VERSION_CONFLICT",
          "The account changed. Refresh and try again.",
        );
      }
      return errorResponse(
        res,
        500,
        "PASSWORD_CHANGE_FAILED",
        "Unable to change the password.",
      );
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    noStore(res);
    if (!requireAllowedOrigin(req, res)) return;

    const token = parseCookie(req.header("Cookie"), COOKIE_NAME);
    if (!token) {
      clearCookie(res, req);
      return res.status(204).send();
    }

    const tokenHash = hashToken(token);
    try {
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: authSessionInclude,
      });
      if (session && sessionValid(session, session.user, new Date())) {
        const csrf = req.header("X-CSRF-Token") ?? "";
        if (!equal(csrf, session.csrfToken)) {
          return errorResponse(res, 403, "CSRF_INVALID", CSRF_INVALID_MESSAGE);
        }
      }
      await prisma.session.deleteMany({ where: { tokenHash } });
      clearCookie(res, req);
      return res.status(204).send();
    } catch {
      return errorResponse(
        res,
        500,
        "AUTH_LOGOUT_FAILED",
        "Unable to sign out right now.",
      );
    }
  });

  app.use(async (req, res, next) => {
    if (req.path === "/api/health") return next();
    try {
      const context = await load(prisma, req, false);
      if (!context?.restricted) return next();
      return errorResponse(
        res,
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Change the initial password before using the application.",
      );
    } catch {
      return errorResponse(
        res,
        500,
        "AUTH_SESSION_FAILED",
        "Unable to restore the authentication session.",
      );
    }
  });
}
