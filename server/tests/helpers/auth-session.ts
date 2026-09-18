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
