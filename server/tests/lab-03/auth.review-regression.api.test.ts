import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { resetLoginThrottle, type AuthPrisma } from "../../src/auth.js";

const origin = "http://127.0.0.1:5173";
const password = "review regression password";

type User = {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER";
  isActive: boolean;
  passwordHash: string | null;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type Session = {
  id: string;
  tokenHash: string;
  userId: number;
  csrfToken: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  user: User;
};

function makePrisma(user: User) {
  const sessions: Session[] = [];
  const prisma: any = {
    requesterUser: {
      findUnique: vi.fn(async (args: any) =>
        args.where.email !== undefined
          ? args.where.email === user.email
            ? user
            : null
          : args.where.id === user.id
            ? user
            : null,
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    session: {
      findUnique: vi.fn(
        async (args: any) =>
          sessions.find((session) =>
            args.where.id !== undefined
              ? session.id === args.where.id
              : session.tokenHash === args.where.tokenHash,
          ) ?? null,
      ),
      create: vi.fn(async (args: any) => {
        const session = {
          id: randomUUID(),
          ...args.data,
          user,
        } as Session;
        sessions.push(session);
        return session;
      }),
      update: vi.fn(async (args: any) => {
        const session = sessions.find((item) => item.id === args.where.id)!;
        Object.assign(session, args.data);
        return session;
      }),
      deleteMany: vi.fn(async (args: any) => {
        const before = sessions.length;
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          const session = sessions[index];
          const tokenMatches =
            args.where?.tokenHash === undefined ||
            session.tokenHash === args.where.tokenHash;
          const userMatches =
            args.where?.userId === undefined || session.userId === args.where.userId;
          if (tokenMatches && userMatches) sessions.splice(index, 1);
        }
        return { count: before - sessions.length };
      }),
    },
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };

  return { prisma: prisma as AuthPrisma, sessions };
}

function user(hash: string | null, mustChangePassword = false): User {
  const now = new Date("2026-09-17T00:00:00Z");
  return {
    id: 1,
    name: "Review User",
    email: "review@example.test",
    role: "REQUESTER",
    isActive: true,
    passwordHash: hash,
    mustChangePassword,
    passwordChangedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function app(prisma: AuthPrisma) {
  return createApp(prisma as unknown as ReferenceDataPrisma);
}

function cookie(res: request.Response) {
  return res.headers["set-cookie"][0].split(";", 1)[0];
}

function exactBody(base: Record<string, unknown>, bytes: number) {
  const empty = JSON.stringify({ ...base, padding: "" });
  return JSON.stringify({
    ...base,
    padding: "x".repeat(bytes - Buffer.byteLength(empty)),
  });
}

describe("Lab 3 auth reviewer regressions", () => {
  let hash: string;
  const previous = process.env.CLIENT_ORIGIN;

  beforeAll(async () => {
    hash = await hashPassword(password);
  });

  beforeEach(() => {
    process.env.CLIENT_ORIGIN = origin;
    resetLoginThrottle();
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previous;
  });

  it("blocks restricted sessions from normal APIs with PASSWORD_CHANGE_REQUIRED", async () => {
    const fixture = makePrisma(user(hash, true));
    const application = app(fixture.prisma);
    const login = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "review@example.test", password });

    expect(login.status).toBe(200);
    const sessionCookie = cookie(login);

    for (const path of [
      "/api/categories",
      "/api/tickets",
      "/api/tickets/1/attachments",
    ]) {
      const response = await request(application)
        .get(path)
        .set("Cookie", sessionCookie)
        .set("X-Requester-Id", "1");
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    }

    const health = await request(application)
      .get("/api/health")
      .set("Cookie", sessionCookie);
    expect(health.status).toBe(200);
  });

  it("enforces the thirty-failure IP window and resets after fifteen minutes", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-17T00:00:00Z"));
      const fixture = makePrisma(user("malformed-hash"));
      const application = app(fixture.prisma);

      for (let index = 0; index < 30; index += 1) {
        fixture.prisma.requesterUser.findUnique = vi.fn(async () => ({
          ...user("malformed-hash"),
          email: `review-${index}@example.test`,
        })) as any;
        const response = await request(application)
          .post("/api/auth/login")
          .set("Origin", origin)
          .send({
            email: `review-${index}@example.test`,
            password: "wrong password",
          });
        expect(response.status).toBe(401);
      }

      const limited = await request(application)
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: "review-next@example.test", password: "wrong password" });
      expect(limited.status).toBe(429);
      expect(limited.headers["retry-after"]).toBe("900");

      vi.advanceTimersByTime(15 * 60 * 1000);
      fixture.prisma.requesterUser.findUnique = vi.fn(async () => ({
        ...user("malformed-hash"),
        email: "review-next@example.test",
      })) as any;

      const afterReset = await request(application)
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: "review-next@example.test", password: "wrong password" });
      expect(afterReset.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets Secure for HTTPS and omits it for explicit local HTTP", async () => {
    const fixture = makePrisma(user(hash));
    const application = app(fixture.prisma);
    const local = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "review@example.test", password });

    expect(local.status).toBe(200);
    expect(local.headers["set-cookie"][0]).not.toMatch(/; Secure(?:;|$)/);

    await request(application)
      .post("/api/auth/logout")
      .set("Origin", origin)
      .set("Cookie", cookie(local))
      .set("X-CSRF-Token", local.body.csrfToken);

    const secure = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .set("X-Forwarded-Proto", "https")
      .send({ email: "review@example.test", password });

    expect(secure.status).toBe(200);
    expect(secure.headers["set-cookie"][0]).toMatch(/; Secure(?:;|$)/);
  });

  it("accepts the 16 KiB boundary for parsing and rejects one byte over it", async () => {
    const fixture = makePrisma(user(hash));
    const application = app(fixture.prisma);
    const base = { email: "review@example.test", password };

    const atBoundary = exactBody(base, 16 * 1024);
    expect(Buffer.byteLength(atBoundary)).toBe(16 * 1024);
    const accepted = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .set("Content-Type", "application/json")
      .send(atBoundary);
    expect(accepted.status).toBe(400);
    expect(accepted.body.error.fieldErrors.padding).toBeDefined();

    const overBoundary = exactBody(base, 16 * 1024 + 1);
    expect(Buffer.byteLength(overBoundary)).toBe(16 * 1024 + 1);
    const rejected = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .set("Content-Type", "application/json")
      .send(overBoundary);
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.fieldErrors.body[0]).toMatch(/16 KiB/);
  });
});
