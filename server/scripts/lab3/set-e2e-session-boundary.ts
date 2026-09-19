import { assertIntegrationDatabase, createIntegrationPrisma } from "../../src/prisma.js";

const mode = process.argv[2];
const email = process.argv[3]?.trim().toLowerCase();
const ALLOWED_EMAILS = new Set([
  "e2e.boundary.requester@example.test",
  "e2e.normal-expiry.requester@example.test",
]);

async function main() {
  if (process.env.NODE_ENV !== "test") throw new Error("E2E session boundary helper is test-only.");
  if ((mode !== "absolute" && mode !== "idle") || !email || !ALLOWED_EMAILS.has(email)) {
    throw new Error("Usage: set-e2e-session-boundary.ts <absolute|idle> <dedicated-e2e-fixture-email>");
  }
  assertIntegrationDatabase();
  const prisma = createIntegrationPrisma();
  try {
    const session = await prisma.session.findFirst({
      where: { user: { email } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!session) throw new Error("Expected isolated E2E session was not found.");
    const now = new Date();
    const data = mode === "absolute"
      ? { expiresAt: now }
      : { lastSeenAt: new Date(now.getTime() - 30 * 60 * 1000) };
    await prisma.session.update({ where: { id: session.id }, data });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to set E2E session boundary.");
  process.exitCode = 1;
});
