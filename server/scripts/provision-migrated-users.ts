import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/password.js";

async function main() {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("Initial-password provisioning requires an interactive TTY.");
  }
  const prisma = getPrisma();
  const users = await prisma.requesterUser.findMany({
    where: { passwordHash: null },
    orderBy: { id: "asc" },
    select: { id: true, email: true, version: true },
  });
  if (users.length === 0) {
    console.log("No unprovisioned users found; no credentials were changed.");
    return;
  }

  const provisioned: Array<{ email: string; initialPassword: string }> = [];
  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      const initialPassword = randomBytes(16).toString("hex");
      const passwordHash = await hashPassword(initialPassword);
      const updated = await tx.requesterUser.updateMany({
        where: { id: user.id, passwordHash: null, version: user.version },
        data: { passwordHash, mustChangePassword: true, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error(`User ${user.id} changed while provisioning; transaction rolled back.`);
      provisioned.push({ email: user.email, initialPassword });
    }
  });

  console.log("Provisioning committed. Deliver each initial password privately now; they are not stored or recoverable:");
  for (const item of provisioned) console.log(`${item.email}: ${item.initialPassword}`);
}

const prisma = getPrisma();
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Initial-password provisioning failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
