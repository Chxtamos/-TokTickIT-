import { getPrisma } from "../../src/prisma.js";
import { hashPassword, validatePasswordInput } from "../../src/password.js";

const REQUESTER_EMAILS = [
  "anan.srisuk@example.test",
  "benjamas.kittipong@example.test",
  "chaiwat.somchai@example.test",
  "daranee.ploy@example.test",
];

async function main() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("E2E Requester provisioning is test-only.");
  }
  const initialPassword = process.env.LAB_SEED_INITIAL_PASSWORD;
  if (!initialPassword || validatePasswordInput(initialPassword).length > 0) {
    throw new Error("A valid LAB_SEED_INITIAL_PASSWORD is required for isolated E2E fixtures.");
  }
  const prisma = getPrisma();
  const passwordHash = await hashPassword(initialPassword);
  const result = await prisma.requesterUser.updateMany({
    where: { email: { in: REQUESTER_EMAILS }, role: "REQUESTER" },
    data: { passwordHash, mustChangePassword: true, version: { increment: 1 } },
  });
  if (result.count !== REQUESTER_EMAILS.length) {
    throw new Error("Expected isolated E2E Requester fixtures were not found.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "E2E Requester provisioning failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
