import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import { resetLoginThrottle, type AuthPrisma } from "../../src/auth.js";

const origin = "http://127.0.0.1:5173";
const initialPassword = "initial password for auth tests";
const replacementPassword = "replacement password for auth tests";

type FakeUser = {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
  passwordHash: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type FakeSession = {
  id: string;
  tokenHash: string;
  userId: number;
  csrfToken: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  user: FakeUser;
};

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  const now = new Date("2026-09-17T00:00:00.000Z");
  return {
    id: 1,
    name: "Anan Srisuk",
    email: "anan.srisuk@example.test",
    role: "REQUESTER",
    isActive: true,
    passwordHash: null,
    mustChangePassword: false,
    passwordChangedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makePrisma(user: FakeUser) {
  const users = [user];
  const sessions: FakeSession[] = [];
  const prisma = {
    requesterUser: {
      findUnique: vi.fn(async (args: any) => {
        if (args.where.email !== undefined) return users.find((item) => item.email === args.where.email) ?? null;
        return users.find((item) => item.id === args.where.id) ?? null;
      }),
      updateMany: vi.fn(async (args: any) => {
        const match = users.find((item) => item.id === args.where.id
          && item.version === args.where.version
          && item.passwordHash === args.where.passwordHash);
        if (!match) return { count: 0 };
        match.passwordHash = args.data.passwordHash;
        match.mustChangePassword = args.data.mustChangePassword;
        match.passwordChangedAt = args.data.passwordChangedAt;
        match.version += args.data.version.increment;
        match.updatedAt = args.data.updatedAt;
        return { count: 1 };
      }),
    },
    session: {
      findUnique: vi.fn(async (args: any) => {
        const found = args.where.id !== undefined
          ? sessions.find((item) => item.id === args.where.id)
          : sessions.find((item) => item.tokenHash === args.where.tokenHash);
        return found ?? null;
      }),
      create: vi.fn(async (args: any) => {
        const created: FakeSession = {
          id: randomUUID(),
          ...args.data,
          user: users.find((item) => item.id === args.data.userId)!,
        };
        sessions.push(created);
        return created;
      }),
      update: vi.fn(async (args: any) => {
        const found = sessions.find((item) => item.id === args.where.id);
        if (!found) throw new Error("session missing");
        Object.assign(found, args.data);
        return found;
      }),
      deleteMany: vi.fn(async (args: any) => {
        const before = sessions.length;
        const where = args.where ?? {};
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          const item = sessions[index];
          if ((where.tokenHash === undefined || item.tokenHash === where.tokenHash)
            && (where.userId === undefined || item.userId === where.userId)) sessions.splice(index, 1);
        }
        return { count: before - sessions.length };
      }),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return { prisma: prisma as unknown as AuthPrisma, user, sessions };
}

function cookiePair(response: request.Response): string {
  const header = response.headers["set-cookie"]?.[0];
  if (!header) throw new Error("Expected a session cookie.");
  return header.split(";", 1)[0];
}

function authApp(prisma: AuthPrisma) {
  return createApp(prisma as unknown as ReferenceDataPrisma);
}

describe("Lab 3 authentication/session APIs", () => {
  let provisionedHash: string;
  const previousOrigin = process.env.CLIENT_ORIGIN;

  beforeAll(async () => {
    provisionedHash = await hashPassword(initialPassword);
  });

  beforeEach(() => {
    process.env.CLIENT_ORIGIN = origin;
    resetLoginThrottle();
  });

  afterAll(() => {
    if (previousOrigin === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previousOrigin;
  });

  it("logs in an active provisioned user with a safe response and normal cookie", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: provisionedHash }));
    const response = await request(authApp(fixture.prisma))
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: " ANAN.SRISUK@EXAMPLE.TEST ", password: initialPassword });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      user: { id: 1, name: "Anan Srisuk", email: "anan.srisuk@example.test", role: "REQUESTER", mustChangePassword: false },
      csrfToken: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(response.body)).not.toContain(provisionedHash);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["set-cookie"][0]).toMatch(/toktickit\.sid=[^;]+; Max-Age=28800; Path=\/api; HttpOnly; SameSite=Lax/);
    expect(fixture.sessions).toHaveLength(1);
  });

  it("creates a fixed fifteen-minute restricted session and never touches lastSeenAt on me", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: provisionedHash, mustChangePassword: true }));
    const login = await request(authApp(fixture.prisma))
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: fixture.user.email, password: initialPassword });
    expect(login.status).toBe(200);
    expect(login.headers["set-cookie"][0]).toMatch(/Max-Age=900/);
    const sessionBefore = { ...fixture.sessions[0] };

    const me = await request(authApp(fixture.prisma)).get("/api/auth/me").set("Cookie", cookiePair(login));
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);
    expect(fixture.sessions[0].lastSeenAt).toEqual(sessionBefore.lastSeenAt);
    expect(fixture.prisma.session.update).not.toHaveBeenCalled();
    expect(fixture.sessions[0].expiresAt.getTime() - fixture.sessions[0].createdAt.getTime()).toBe(15 * 60 * 1000);
  });

  it("uses the same generic 401 for unknown, wrong, inactive and unprovisioned accounts", async () => {
    const cases = [
      makeUser({ passwordHash: provisionedHash }),
      makeUser({ passwordHash: "malformed-hash" }),
      makeUser({ passwordHash: provisionedHash, isActive: false }),
      makeUser({ passwordHash: null }),
    ];
    for (const user of cases) {
      const fixture = makePrisma(user);
      const response = await request(authApp(fixture.prisma))
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: user.email, password: "wrong password" });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Unable to sign in with those credentials. Check your details or contact an administrator.",
        },
      });
      resetLoginThrottle();
    }

    const unknown = makePrisma(makeUser({ email: "different@example.test", passwordHash: provisionedHash }));
    const response = await request(authApp(unknown.prisma))
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "unknown@example.test", password: "wrong password" });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Unable to sign in with those credentials. Check your details or contact an administrator.");
  });

  it("rotates password and sessions atomically from the API perspective", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: provisionedHash, mustChangePassword: true }));
    const app = authApp(fixture.prisma);
    const login = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: fixture.user.email, password: initialPassword });
    const oldCookie = cookiePair(login);
    const oldCsrf = login.body.csrfToken as string;

    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", origin)
      .set("X-CSRF-Token", oldCsrf)
      .set("Cookie", oldCookie)
      .send({ currentPassword: initialPassword, newPassword: replacementPassword, confirmPassword: replacementPassword });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.body.csrfToken).not.toBe(oldCsrf);
    expect(await verifyPassword(replacementPassword, fixture.user.passwordHash!)).toBe(true);
    expect(fixture.sessions).toHaveLength(1);
    expect(fixture.sessions[0].csrfToken).toBe(changed.body.csrfToken);

    const oldReplay = await request(app).get("/api/auth/me").set("Cookie", oldCookie);
    expect(oldReplay.status).toBe(401);
    const newSession = await request(app).get("/api/auth/me").set("Cookie", cookiePair(changed));
    expect(newSession.status).toBe(200);
  });

  it("requires exact Origin and CSRF for active writes while keeping logout idempotent", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: provisionedHash }));
    const app = authApp(fixture.prisma);
    const login = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: fixture.user.email, password: initialPassword });
    const cookie = cookiePair(login);
    const csrf = login.body.csrfToken as string;

    const badOrigin = await request(app).post("/api/auth/logout").set("Origin", "https://evil.example").set("Cookie", cookie).set("X-CSRF-Token", csrf);
    expect(badOrigin.status).toBe(403);
    expect(fixture.sessions).toHaveLength(1);
    const badCsrf = await request(app).post("/api/auth/logout").set("Origin", origin).set("Cookie", cookie).set("X-CSRF-Token", "0".repeat(64));
    expect(badCsrf.status).toBe(403);
    expect(fixture.sessions).toHaveLength(1);

    const loggedOut = await request(app).post("/api/auth/logout").set("Origin", origin).set("Cookie", cookie).set("X-CSRF-Token", csrf);
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.text).toBe("");
    expect(fixture.sessions).toHaveLength(0);
    const repeated = await request(app).post("/api/auth/logout").set("Origin", origin).set("Cookie", cookie);
    expect(repeated.status).toBe(204);
    const absent = await request(app).post("/api/auth/logout").set("Origin", origin);
    expect(absent.status).toBe(204);
  });

  it("rejects malformed JSON and enforces the normal idle boundary", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: provisionedHash }));
    const app = authApp(fixture.prisma);
    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("VALIDATION_FAILED");

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-17T00:00:00.000Z"));
      const login = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: fixture.user.email, password: initialPassword });
      const cookie = cookiePair(login);
      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      await expect(request(app).get("/api/auth/me").set("Cookie", cookie)).resolves.toMatchObject({ status: 200 });
      // The successful request advances lastSeenAt; the exact idle boundary
      // is measured from that refreshed timestamp.
      vi.advanceTimersByTime(30 * 60 * 1000);
      const expired = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(expired.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires a restricted session at exactly fifteen minutes and still permits idempotent logout", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: provisionedHash, mustChangePassword: true }));
    const app = authApp(fixture.prisma);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-17T00:00:00.000Z"));
      const login = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: fixture.user.email, password: initialPassword });
      const cookie = cookiePair(login);
      const csrf = login.body.csrfToken as string;
      vi.advanceTimersByTime(15 * 60 * 1000);
      const expired = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(expired.status).toBe(401);
      const logout = await request(app).post("/api/auth/logout").set("Origin", origin).set("Cookie", cookie).set("X-CSRF-Token", csrf);
      expect(logout.status).toBe(204);
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks the sixth failed email/IP attempt with a bounded Retry-After", async () => {
    const fixture = makePrisma(makeUser({ passwordHash: "malformed-hash" }));
    const app = authApp(fixture.prisma);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: fixture.user.email, password: "wrong password" });
      expect(response.status).toBe(401);
    }
    const limited = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: fixture.user.email, password: "wrong password" });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("LOGIN_RATE_LIMITED");
    expect(limited.headers["retry-after"]).toMatch(/^\d+$/);
  });
});
