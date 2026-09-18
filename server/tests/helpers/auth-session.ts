import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export const testClientOrigin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173";

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
