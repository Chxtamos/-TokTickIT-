import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../../src/password.js";

export const testClientOrigin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173";
let integrationPasswordHash: Promise<string> | undefined;

export async function createProvisionedTestUser(
  prisma: PrismaClient,
  role: UserRole,
  label: string,
) {
  integrationPasswordHash ??= hashPassword("integration test password 2026");
  return prisma.requesterUser.create({
    data: {
      name: `Lab 3 ${label}`,
      email: `lab3-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID()}@example.test`,
      role,
      isActive: true,
      passwordHash: await integrationPasswordHash,
      mustChangePassword: false,
    },
  });
}

export async function createTestSession(prisma: PrismaClient, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("hex");
  const createdAt = new Date();
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      csrfToken,
      createdAt,
      lastSeenAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + 8 * 60 * 60 * 1000),
    },
  });
  return { cookie: `toktickit.sid=${token}`, csrfToken };
}


export function withMockRequesterSession<T extends object>(prisma: T, userId = 1) {
  const token = "legacy-unit-session-token";
  const csrfToken = "legacy-unit-session-csrf";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = {
    id: userId,
    name: "Legacy unit requester",
    email: "legacy-unit-requester@example.test",
    role: "REQUESTER" as const,
    isActive: true,
    passwordHash: "unused",
    mustChangePassword: false,
    passwordChangedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };

  return {
    prisma: {
      ...prisma,
      session: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          where.tokenHash === tokenHash
            ? {
                id: "00000000-0000-4000-8000-000000000099",
                tokenHash,
                userId,
                csrfToken,
                createdAt: new Date(),
                lastSeenAt: new Date(),
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
                user,
              }
            : null,
        update: async () => ({}),
        deleteMany: async () => ({ count: 0 }),
      },
    } as T,
    cookie: `toktickit.sid=${token}`,
    csrfToken,
  };
}
