import type { Express, Request, Response } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hashPassword, validatePasswordInput, verifyPassword } from "./password.js";

export type AuthPrisma = Pick<PrismaClient, "requesterUser" | "session" | "$transaction">;

const COOKIE_NAME = "toktickit.sid";
const NORMAL_SESSION_MS = 8 * 60 * 60 * 1000;
const NORMAL_IDLE_MS = 30 * 60 * 1000;
const RESTRICTED_SESSION_MS = 15 * 60 * 1000;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const PAIR_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 30;
const PASSWORD_BODY_LIMIT = 16 * 1024;
const MAX_THROTTLE_BUCKETS = 10_000;
const INVALID_CREDENTIALS_MESSAGE = "Unable to sign in with those credentials. Check your details or contact an administrator.";
const SESSION_REQUIRED_MESSAGE = "An active authentication session is required.";
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

const authSessionInclude = { user: { select: authUserSelect } } as const;
type AuthUser = Prisma.RequesterUserGetPayload<{ select: typeof authUserSelect }>;
type AuthSession = Prisma.SessionGetPayload<{ include: typeof authSessionInclude }>;

type LoginInput = { email: string; password: string };
type ChangePasswordInput = { currentPassword: string; newPassword: string; confirmPassword: string };
type SessionContext = { session: AuthSession; token: string; tokenHash: string; restricted: boolean };
type ThrottleBucket = { count: number; startedAt: number };

const pairBuckets = new Map<string, ThrottleBucket>();
const ipBuckets = new Map<string, ThrottleBucket>();

const dummyPasswordHash = [
  "scrypt-v1",
  "N=131072,r=8,p=1",
  Buffer.alloc(16).toString("base64url"),
  Buffer.alloc(64).toString("base64url"),
].join("$");

export function resetLoginThrottle(): void {
  pairBuckets.clear();
  ipBuckets.clear();
}

function noStore(res: Response): void {
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
  const error: { code: string; message: string; fieldErrors?: Record<string, string[]>; correlationId?: string } = { code, message };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  if (status >= 500) error.correlationId = randomUUID();
  return res.status(status).json({ error });
}

function randomUUID(): string {
  return randomBytes(16).toString("hex");
}

function configuredOrigin(): string | null {
  const value = process.env.CLIENT_ORIGIN?.trim();
  return value && /^https?:\/\/[^\s/]+(?::\d+)?$/.test(value) ? value : null;
}

function hasAllowedOrigin(req: Request): boolean {
  const origin = req.header("Origin");
  const expected = configuredOrigin();
  return expected !== null && origin === expected;
}

function requireAllowedOrigin(req: Request, res: Response): boolean {
  if (hasAllowedOrigin(req)) return true;
  errorResponse(res, 403, "CSRF_INVALID", CSRF_INVALID_MESSAGE);
  return false;
}

function isJsonRequest(req: Request): boolean {
  return (req.header("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase() === "application/json";
}

function requestBodyWithinLimit(req: Request): boolean {
  const contentLength = req.header("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > PASSWORD_BODY_LIMIT) return false;
  try {
    return Buffer.byteLength(JSON.stringify(req.body ?? null), "utf8") <= PASSWORD_BODY_LIMIT;
  } catch {
    return false;
  }
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }
  return null;
}

function requestIsHttps(req: Request): boolean {
  return req.secure || req.protocol === "https" || req.header("X-Forwarded-Proto")?.split(",", 1)[0].trim() === "https";
}

function sessionCookie(req: Request, token: string, maxAgeSeconds: number): string {
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/api",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (requestIsHttps(req)) attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie(req: Request): string {
  const attributes = [
    `${COOKIE_NAME}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Path=/api",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (requestIsHttps(req)) attributes.push("Secure");
  return attributes.join("; ");
}

function setSessionCookie(res: Response, req: Request, token: string, restricted: boolean): void {
  res.setHeader("Set-Cookie", sessionCookie(req, token, Math.floor((restricted ? RESTRICTED_SESSION_MS : NORMAL_SESSION_MS) / 1000)));
}

function setClearedCookie(res: Response, req: Request): void {
  res.setHeader("Set-Cookie", clearSessionCookie(req));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashThrottleKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function remoteAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function activeBucket(map: Map<string, ThrottleBucket>, key: string, now: number): ThrottleBucket {
  const existing = map.get(key);
  if (!existing || now - existing.startedAt >= THROTTLE_WINDOW_MS) {
    const fresh = { count: 0, startedAt: now };
    map.set(key, fresh);
    return fresh;
  }
  return existing;
}

function pruneBuckets(map: Map<string, ThrottleBucket>, now: number): void {
  for (const [key, bucket] of map) {
    if (now - bucket.startedAt >= THROTTLE_WINDOW_MS) map.delete(key);
  }
  if (map.size <= MAX_THROTTLE_BUCKETS) return;
  const oldest = [...map.entries()]
    .sort(([, left], [, right]) => left.startedAt - right.startedAt)
    .slice(0, map.size - MAX_THROTTLE_BUCKETS);
  for (const [key] of oldest) map.delete(key);
}

function throttleRetryAfter(email: string, ip: string, now: number): number | null {
  pruneBuckets(pairBuckets, now);
  pruneBuckets(ipBuckets, now);
  const pair = activeBucket(pairBuckets, hashThrottleKey(`${email}\n${ip}`), now);
  const address = activeBucket(ipBuckets, hashThrottleKey(ip), now);
  const retryAt: number[] = [];
  if (pair.count >= PAIR_FAILURE_LIMIT) retryAt.push(pair.startedAt + THROTTLE_WINDOW_MS);
  if (address.count >= IP_FAILURE_LIMIT) retryAt.push(address.startedAt + THROTTLE_WINDOW_MS);
  if (retryAt.length === 0) return null;
  return Math.max(1, Math.ceil((Math.max(...retryAt) - now) / 1000));
}

function recordFailedLogin(email: string, ip: string, now: number): void {
  pruneBuckets(pairBuckets, now);
  pruneBuckets(ipBuckets, now);
  const pair = activeBucket(pairBuckets, hashThrottleKey(`${email}\n${ip}`), now);
  pair.count += 1;
  const address = activeBucket(ipBuckets, hashThrottleKey(ip), now);
  address.count += 1;
}

function resetPairBucket(email: string, ip: string): void {
  pairBuckets.delete(hashThrottleKey(`${email}\n${ip}`));
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function emailIsValid(email: string): boolean {
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateLoginBody(body: unknown): { input?: LoginInput; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (key !== "email" && key !== "password") fieldErrors[key] = ["This field is not supported."];
  }

  const email = typeof raw.email === "string" ? normalizeEmail(raw.email) : "";
  if (!emailIsValid(email)) fieldErrors.email = ["Enter a valid email address."];
  const password = typeof raw.password === "string" ? raw.password : "";
  if (typeof raw.password !== "string" || password.length === 0) {
    fieldErrors.password = ["Password is required."];
  } else if (Array.from(password).length > 128 || Buffer.byteLength(password, "utf8") > 512) {
    fieldErrors.password = ["Password must contain at most 128 characters and 512 UTF-8 bytes."];
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { email, password }, fieldErrors };
}

function validateChangePasswordBody(body: unknown): { input?: ChangePasswordInput; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!["currentPassword", "newPassword", "confirmPassword"].includes(key)) fieldErrors[key] = ["This field is not supported."];
  }
  const currentPassword = typeof raw.currentPassword === "string" ? raw.currentPassword : "";
  const newPassword = typeof raw.newPassword === "string" ? raw.newPassword : "";
  const confirmPassword = typeof raw.confirmPassword === "string" ? raw.confirmPassword : "";
  if (typeof raw.currentPassword !== "string" || currentPassword.length === 0) fieldErrors.currentPassword = ["Current password is required."];
  const passwordErrors = validatePasswordInput(newPassword);
  if (typeof raw.newPassword !== "string" || passwordErrors.length > 0) fieldErrors.newPassword = passwordErrors.length > 0 ? passwordErrors : ["New password is required."];
  if (typeof raw.confirmPassword !== "string" || confirmPassword.length === 0) fieldErrors.confirmPassword = ["Confirm password is required."];
  else if (newPassword !== confirmPassword) fieldErrors.confirmPassword = ["Passwords must match exactly."];
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { currentPassword, newPassword, confirmPassword }, fieldErrors };
}

function safeUser(user: AuthUser): { id: number; name: string; email: string; role: AuthUser["role"]; mustChangePassword: boolean } {
  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
}

function authResponse(user: AuthUser, csrfToken: string) {
  return { user: safeUser(user), csrfToken };
}

function sessionIsValid(session: Pick<AuthSession, "expiresAt" | "lastSeenAt">, user: Pick<AuthUser, "isActive" | "mustChangePassword">, now: Date): boolean {
  if (!user.isActive || now.getTime() >= session.expiresAt.getTime()) return false;
  if (user.mustChangePassword) return true;
  return now.getTime() - session.lastSeenAt.getTime() < NORMAL_IDLE_MS;
}

async function loadSession(prisma: AuthPrisma, req: Request, touch: boolean): Promise<SessionContext | null> {
  const token = parseCookie(req.header("Cookie"), COOKIE_NAME);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: authSessionInclude });
  if (!session) return null;
  const now = new Date();
  const restricted = session.user.mustChangePassword;
  if (!sessionIsValid(session, session.user, now)) return null;
  if (touch && !restricted) await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  return { session, token, tokenHash, restricted };
}

function databaseLockQueries(tx: Prisma.TransactionClient, userId: number, sessionId: string): Promise<unknown>[] {
  if (typeof tx.$queryRaw !== "function") return [];
  return [
    tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`),
    tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE`),
  ];
}

export function registerAuthRoutes(app: Express, prisma: AuthPrisma): void {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    noStore(res);
    if (!requireAllowedOrigin(req, res)) return;
    if (!isJsonRequest(req) || !requestBodyWithinLimit(req)) {
      return errorResponse(res, 400, "VALIDATION_FAILED", "Please send a JSON login request within the allowed size.", {
        body: ["Login requests must be JSON and no larger than 16 KiB."],
      });
    }
    const { input, fieldErrors } = validateLoginBody(req.body);
    if (!input) return errorResponse(res, 400, "VALIDATION_FAILED", "Please correct the highlighted fields.", fieldErrors);

    const ip = remoteAddress(req);
    const now = Date.now();
    const retryAfter = throttleRetryAfter(input.email, ip, now);
    if (retryAfter !== null) {
      res.setHeader("Retry-After", String(retryAfter));
      return errorResponse(res, 429, "LOGIN_RATE_LIMITED", "Too many sign-in attempts. Please try again later.");
    }

    let user: AuthUser | null = null;
    try {
      user = await prisma.requesterUser.findUnique({ where: { email: input.email }, select: authUserSelect });
    } catch {
      return errorResponse(res, 500, "AUTH_LOGIN_FAILED", "Unable to sign in right now. Please try again.");
    }

    const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
    if (!user || !user.isActive || !user.passwordHash || !passwordMatches) {
      recordFailedLogin(input.email, ip, Date.now());
      return errorResponse(res, 401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
    }

    resetPairBucket(input.email, ip);
    const token = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("hex");
    const createdAt = new Date();
    const restricted = user.mustChangePassword;
    const expiresAt = new Date(createdAt.getTime() + (restricted ? RESTRICTED_SESSION_MS : NORMAL_SESSION_MS));
    try {
      await prisma.$transaction(async (tx) => {
        const presentedToken = parseCookie(req.header("Cookie"), COOKIE_NAME);
        if (presentedToken) await tx.session.deleteMany({ where: { tokenHash: hashToken(presentedToken) } });
        await tx.session.create({ data: { tokenHash: hashToken(token), userId: user!.id, csrfToken, createdAt, lastSeenAt: createdAt, expiresAt } });
      });
    } catch {
      return errorResponse(res, 500, "AUTH_LOGIN_FAILED", "Unable to sign in right now. Please try again.");
    }

    setSessionCookie(res, req, token, restricted);
    return res.status(200).json(authResponse(user, csrfToken));
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    noStore(res);
    try {
      const context = await loadSession(prisma, req, true);
      if (!context) {
        setClearedCookie(res, req);
        return errorResponse(res, 401, "SESSION_REQUIRED", SESSION_REQUIRED_MESSAGE);
      }
      return res.status(200).json(authResponse(context.session.user, context.session.csrfToken));
    } catch {
      return errorResponse(res, 500, "AUTH_SESSION_FAILED", "Unable to restore the authentication session.");
    }
  });

  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    noStore(res);
    let context: SessionContext | null;
    try {
      context = await loadSession(prisma, req, false);
    } catch {
      return errorResponse(res, 500, "AUTH_SESSION_FAILED", "Unable to restore the authentication session.");
    }
    if (!context) {
      setClearedCookie(res, req);
      return errorResponse(res, 401, "SESSION_REQUIRED", SESSION_REQUIRED_MESSAGE);
    }
    if (!requireAllowedOrigin(req, res)) return;
    const csrf = req.header("X-CSRF-Token") ?? "";
    if (!constantTimeEqual(csrf, context.session.csrfToken)) {
      return errorResponse(res, 403, "CSRF_INVALID", CSRF_INVALID_MESSAGE);
    }
    if (!isJsonRequest(req) || !requestBodyWithinLimit(req)) {
      return errorResponse(res, 400, "VALIDATION_FAILED", "Please send a JSON password request within the allowed size.", {
        body: ["Password requests must be JSON and no larger than 16 KiB."],
      });
    }
    const { input, fieldErrors } = validateChangePasswordBody(req.body);
    if (!input) return errorResponse(res, 400, "VALIDATION_FAILED", "Please correct the highlighted fields.", fieldErrors);

    const currentUser = context.session.user;
    if (!currentUser.passwordHash || !(await verifyPassword(input.currentPassword, currentUser.passwordHash))) {
      return errorResponse(res, 401, "CURRENT_PASSWORD_INVALID", "The current password is incorrect.");
    }
    if (input.newPassword === input.currentPassword || await verifyPassword(input.newPassword, currentUser.passwordHash)) {
      return errorResponse(res, 400, "VALIDATION_FAILED", "Please correct the highlighted fields.", {
        newPassword: ["New password must differ from the current password."],
      });
    }

    let replacementHash: string;
    try {
      replacementHash = await hashPassword(input.newPassword);
    } catch {
      return errorResponse(res, 500, "PASSWORD_CHANGE_FAILED", "Unable to change the password.");
    }
    const replacementToken = randomBytes(32).toString("base64url");
    const replacementCsrf = randomBytes(32).toString("hex");
    const committedAt = new Date();
    const replacementExpiresAt = new Date(committedAt.getTime() + NORMAL_SESSION_MS);

    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        await Promise.all(databaseLockQueries(tx, currentUser.id, context!.session.id));
        const latestUser = await tx.requesterUser.findUnique({ where: { id: currentUser.id }, select: authUserSelect });
        const latestSession = await tx.session.findUnique({ where: { id: context!.session.id }, include: authSessionInclude });
        if (!latestUser || !latestSession
          || latestSession.user.id !== currentUser.id
          || latestSession.tokenHash !== context!.tokenHash
          || latestSession.csrfToken !== context!.session.csrfToken
          || latestUser.version !== currentUser.version
          || latestUser.passwordHash !== currentUser.passwordHash
          || !sessionIsValid(latestSession, latestUser, committedAt)) {
          throw new Error("VERSION_CONFLICT");
        }
        const updated = await tx.requesterUser.updateMany({
          where: { id: currentUser.id, version: currentUser.version, passwordHash: currentUser.passwordHash },
          data: {
            passwordHash: replacementHash,
            mustChangePassword: false,
            passwordChangedAt: committedAt,
            version: { increment: 1 },
            updatedAt: committedAt,
          },
        });
        if (updated.count !== 1) throw new Error("VERSION_CONFLICT");
        await tx.session.deleteMany({ where: { userId: currentUser.id } });
        await tx.session.create({
          data: {
            tokenHash: hashToken(replacementToken),
            userId: currentUser.id,
            csrfToken: replacementCsrf,
            createdAt: committedAt,
            lastSeenAt: committedAt,
            expiresAt: replacementExpiresAt,
          },
        });
        return {
          ...latestUser,
          passwordHash: replacementHash,
          mustChangePassword: false,
          passwordChangedAt: committedAt,
          version: latestUser.version + 1,
          updatedAt: committedAt,
        };
      });
      setSessionCookie(res, req, replacementToken, false);
      return res.status(200).json(authResponse(updatedUser, replacementCsrf));
    } catch (error) {
      if (error instanceof Error && error.message === "VERSION_CONFLICT") {
        return errorResponse(res, 409, "VERSION_CONFLICT", "The account changed. Refresh and try again.");
      }
      return errorResponse(res, 500, "PASSWORD_CHANGE_FAILED", "Unable to change the password.");
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    noStore(res);
    if (!requireAllowedOrigin(req, res)) return;
    const token = parseCookie(req.header("Cookie"), COOKIE_NAME);
    if (!token) {
      setClearedCookie(res, req);
      return res.status(204).send();
    }
    const tokenHash = hashToken(token);
    try {
      const session = await prisma.session.findUnique({ where: { tokenHash }, include: authSessionInclude });
      const now = new Date();
      if (session && sessionIsValid(session, session.user, now)) {
        const csrf = req.header("X-CSRF-Token") ?? "";
        if (!constantTimeEqual(csrf, session.csrfToken)) return errorResponse(res, 403, "CSRF_INVALID", CSRF_INVALID_MESSAGE);
      }
      await prisma.session.deleteMany({ where: { tokenHash } });
      setClearedCookie(res, req);
      return res.status(204).send();
    } catch {
      return errorResponse(res, 500, "AUTH_LOGOUT_FAILED", "Unable to sign out right now.");
    }
  });
}
