import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { hashPassword, verifyPassword } from "../../src/password.js";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

const origin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173";
const email = "lab3-auth-rollback@example.test";
const initial = "rollback initial password 2026";
const replacement = "rollback replacement password 2026";

type Stage = "user-update" | "session-delete" | "replacement-insert";

function cookie(res: request.Response) {
  const header = res.headers["set-cookie"]?.[0];
  if (!header) throw new Error("Expected session cookie");
  return header.split(";", 1)[0];
}

function faulting(real: PrismaClient, stage: Stage): ReferenceDataPrisma {
  const proxy: any = {
    requesterUser: real.requesterUser,
    session: real.session,
    $queryRaw: (...args: any[]) => (real.$queryRaw as any)(...args),
  };

  proxy.$transaction = async (callback: any) =>
    real.$transaction(async (tx: any) =>
      callback({
        $queryRaw: (...args: any[]) => tx.$queryRaw(...args),
        requesterUser: {
          findUnique: (args: any) => tx.requesterUser.findUnique(args),
          updateMany: async (args: any) => {
            if (stage === "user-update") throw new Error("FAULT_USER_UPDATE");
            return tx.requesterUser.updateMany(args);
          },
        },
        session: {
          findUnique: (args: any) => tx.session.findUnique(args),
          deleteMany: async (args: any) => {
            if (stage === "session-delete") {
              throw new Error("FAULT_SESSION_DELETE");
            }
            return tx.session.deleteMany(args);
          },
          create: async (args: any) => {
            if (stage === "replacement-insert") {
              throw new Error("FAULT_REPLACEMENT_INSERT");
            }
            return tx.session.create(args);
          },
        },
      }),
    );

  return proxy as ReferenceDataPrisma;
}

integration("Lab 3 password-change transaction failure semantics", () => {
  let prisma: PrismaClient;
  let userId = 0;
  let initialHash: string;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    initialHash = await hashPassword(initial);
    await prisma.requesterUser.deleteMany({ where: { email } });
    const user = await prisma.requesterUser.create({
      data: {
        name: "Rollback User",
        email,
        role: "REQUESTER",
        isActive: true,
        passwordHash: initialHash,
        mustChangePassword: true,
      },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.requesterUser.update({
      where: { id: userId },
      data: {
        passwordHash: initialHash,
        mustChangePassword: true,
        passwordChangedAt: null,
        version: 1,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.requesterUser
        .delete({ where: { id: userId } })
        .catch(() => undefined);
      await prisma.$disconnect();
    }
  });

  for (const stage of [
    "user-update",
    "session-delete",
    "replacement-insert",
  ] as const) {
    it(`rolls back the complete password rotation when ${stage} fails`, async () => {
      const normal = createApp(prisma as unknown as ReferenceDataPrisma);
      const login = await request(normal)
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email, password: initial });

      expect(login.status).toBe(200);
      const oldCookie = cookie(login);
      const oldCsrf = login.body.csrfToken as string;
      const beforeUser = await prisma.requesterUser.findUniqueOrThrow({
        where: { id: userId },
      });
      const beforeSession = await prisma.session.findFirstOrThrow({
        where: { userId },
      });

      const failed = await request(createApp(faulting(prisma, stage)))
        .post("/api/auth/change-password")
        .set("Origin", origin)
        .set("X-CSRF-Token", oldCsrf)
        .set("Cookie", oldCookie)
        .send({
          currentPassword: initial,
          newPassword: replacement,
          confirmPassword: replacement,
        });

      expect(failed.status).toBe(500);
      expect(failed.body.error.code).toBe("PASSWORD_CHANGE_FAILED");
      expect(failed.headers["set-cookie"]).toBeUndefined();

      const afterUser = await prisma.requesterUser.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(afterUser.passwordHash).toBe(beforeUser.passwordHash);
      expect(afterUser.mustChangePassword).toBe(true);
      expect(afterUser.version).toBe(beforeUser.version);
      expect(await verifyPassword(initial, afterUser.passwordHash!)).toBe(true);
      expect(await verifyPassword(replacement, afterUser.passwordHash!)).toBe(false);

      const afterSession = await prisma.session.findFirstOrThrow({
        where: { userId },
      });
      expect(afterSession.id).toBe(beforeSession.id);
      expect(afterSession.tokenHash).toBe(beforeSession.tokenHash);

      const oldSession = await request(normal)
        .get("/api/auth/me")
        .set("Cookie", oldCookie);
      expect(oldSession.status).toBe(200);
    });
  }

  it("recovers by logging in with the new password when the committed response is lost", async () => {
    const application = createApp(prisma as unknown as ReferenceDataPrisma);
    const login = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password: initial });
    const oldCookie = cookie(login);
    const csrf = login.body.csrfToken as string;

    const committed = await request(application)
      .post("/api/auth/change-password")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .set("Cookie", oldCookie)
      .send({
        currentPassword: initial,
        newPassword: replacement,
        confirmPassword: replacement,
      });
    expect(committed.status).toBe(200);

    // Simulate transport loss by intentionally discarding the replacement cookie/body.
    const oldSession = await request(application)
      .get("/api/auth/me")
      .set("Cookie", oldCookie);
    expect(oldSession.status).toBe(401);

    const oldPassword = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password: initial });
    expect(oldPassword.status).toBe(401);

    const recovered = await request(application)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password: replacement });
    expect(recovered.status).toBe(200);
    expect(recovered.body.user.mustChangePassword).toBe(false);

    const restoredSession = await request(application)
      .get("/api/auth/me")
      .set("Cookie", cookie(recovered));
    expect(restoredSession.status).toBe(200);
  });
});
