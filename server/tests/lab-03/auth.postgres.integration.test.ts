import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;
const origin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173";
const email = "lab3-auth-integration@example.test";
const initialPassword = "integration initial password 2026";
const replacementPassword = "integration replacement password 2026";

function cookiePair(response: request.Response): string {
  const header = response.headers["set-cookie"]?.[0];
  if (!header) throw new Error("Expected a session cookie.");
  return header.split(";", 1)[0];
}

integration("Lab 3 authentication PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let userId: number;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    await prisma.requesterUser.deleteMany({ where: { email } });
    const passwordHash = await hashPassword(initialPassword);
    const user = await prisma.requesterUser.create({
      data: {
        name: "Lab 3 Auth Integration",
        email,
        role: "REQUESTER",
        isActive: true,
        passwordHash,
        mustChangePassword: true,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (userId) await prisma.requesterUser.delete({ where: { id: userId } }).catch(() => undefined);
      await prisma.$disconnect();
    }
  });

  it("persists restricted login, atomic password rotation and idempotent logout", async () => {
    const app = createApp(prisma);
    const login = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password: initialPassword });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ id: userId, role: "REQUESTER", mustChangePassword: true });
    expect(login.headers["set-cookie"][0]).toMatch(/Max-Age=900/);
    const oldCookie = cookiePair(login);
    const oldCsrf = login.body.csrfToken as string;
    const oldSession = await prisma.session.findFirst({ where: { userId } });
    expect(oldSession).not.toBeNull();

    const me = await request(app).get("/api/auth/me").set("Cookie", oldCookie);
    expect(me.status).toBe(200);
    expect(me.body.csrfToken).toBe(oldCsrf);

    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", origin)
      .set("X-CSRF-Token", oldCsrf)
      .set("Cookie", oldCookie)
      .send({ currentPassword: initialPassword, newPassword: replacementPassword, confirmPassword: replacementPassword });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(changed.headers["set-cookie"][0]).toMatch(/Max-Age=28800/);

    const stored = await prisma.requesterUser.findUnique({ where: { id: userId } });
    expect(stored).toMatchObject({ mustChangePassword: false, version: 2 });
    expect(await verifyPassword(replacementPassword, stored!.passwordHash!)).toBe(true);
    await expect(prisma.session.findUnique({ where: { id: oldSession!.id } })).resolves.toBeNull();
    await expect(prisma.session.count({ where: { userId } })).resolves.toBe(1);

    const oldReplay = await request(app).get("/api/auth/me").set("Cookie", oldCookie);
    expect(oldReplay.status).toBe(401);
    const newCookie = cookiePair(changed);
    await expect(request(app).get("/api/auth/me").set("Cookie", newCookie)).resolves.toMatchObject({ status: 200 });

    const logout = await request(app).post("/api/auth/logout").set("Origin", origin).set("Cookie", newCookie).set("X-CSRF-Token", changed.body.csrfToken);
    expect(logout.status).toBe(204);
    const repeated = await request(app).post("/api/auth/logout").set("Origin", origin).set("Cookie", newCookie);
    expect(repeated.status).toBe(204);
  });
});
