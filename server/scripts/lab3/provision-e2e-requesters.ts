import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertIntegrationDatabase, createIntegrationPrisma } from "../../src/prisma.js";
import { hashPassword, validatePasswordInput } from "../../src/password.js";

const REQUESTER_EMAILS = [
  "anan.srisuk@example.test",
  "benjamas.kittipong@example.test",
  "chaiwat.somchai@example.test",
  "daranee.ploy@example.test",
];
const STAFF_FLOW_TICKET = "TKT-2026-900011";
const STAFF_ATTACHMENT_KEY = "11111111-1111-4111-8111-111111111111";
const STAFF_ATTACHMENT_NAME = "staff-e2e.pdf";
const STAFF_ATTACHMENT_BYTES = Buffer.from("%PDF-1.4\n% TokTickIT E2E fixture\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "utf8");

async function main() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("E2E Requester provisioning is test-only.");
  }
  // BR-40: fail closed before creating a Prisma client. This script never
  // inherits DATABASE_URL as a fallback, even if the caller forgot to set
  // RUN_DB_INTEGRATION.
  assertIntegrationDatabase();
  const initialPassword = process.env.LAB_SEED_INITIAL_PASSWORD;
  if (!initialPassword || validatePasswordInput(initialPassword).length > 0) {
    throw new Error("A valid LAB_SEED_INITIAL_PASSWORD is required for isolated E2E fixtures.");
  }
  const prisma = createIntegrationPrisma();
  try {
    const passwordHash = await hashPassword(initialPassword);
    const dedicatedAccounts = [
      { name: "E2E Auth Requester", email: "e2e.auth.requester@example.test", role: "REQUESTER" as const, mustChangePassword: true },
      { name: "E2E Boundary Requester", email: "e2e.boundary.requester@example.test", role: "REQUESTER" as const, mustChangePassword: true },
      { name: "E2E Normal Expiry Requester", email: "e2e.normal-expiry.requester@example.test", role: "REQUESTER" as const, mustChangePassword: true },
      { name: "E2E Staff", email: "e2e.staff@example.test", role: "IT_STAFF" as const, mustChangePassword: false },
      { name: "E2E Administrator", email: "e2e.admin@example.test", role: "ADMINISTRATOR" as const, mustChangePassword: false },
    ];
    for (const account of dedicatedAccounts) {
      await prisma.requesterUser.upsert({
        where: { email: account.email },
        update: { name: account.name, passwordHash, mustChangePassword: account.mustChangePassword, isActive: true, role: account.role, version: { increment: 1 } },
        create: {
          name: account.name,
          email: account.email,
          role: account.role,
          isActive: true,
          passwordHash,
          mustChangePassword: account.mustChangePassword,
        },
      });
    }
    const result = await prisma.requesterUser.updateMany({
      where: { email: { in: REQUESTER_EMAILS }, role: "REQUESTER" },
      data: { passwordHash, mustChangePassword: true, version: { increment: 1 } },
    });
    if (result.count !== REQUESTER_EMAILS.length) {
      throw new Error("Expected isolated E2E Requester fixtures were not found.");
    }
    const fixtureEmails = [...REQUESTER_EMAILS, ...dedicatedAccounts.map((account) => account.email)];
    await prisma.session.deleteMany({ where: { user: { email: { in: fixtureEmails } } } });

    const ticket = await prisma.ticket.findFirst({
      where: { ticketNumber: STAFF_FLOW_TICKET, requester: { email: REQUESTER_EMAILS[0] } },
      select: { id: true },
    });
    if (!ticket) throw new Error("Expected owned isolated E2E Ticket fixture was not found.");

    await prisma.$transaction(async (tx) => {
      await tx.ticketOwnerChange.deleteMany({ where: { ticketId: ticket.id } });
      await tx.publicComment.deleteMany({ where: { ticketId: ticket.id, content: { startsWith: "E2E " } } });
      await tx.internalNote.deleteMany({ where: { ticketId: ticket.id, content: { startsWith: "E2E " } } });
      await tx.attachment.deleteMany({ where: { OR: [{ storageKey: STAFF_ATTACHMENT_KEY }, { ticketId: ticket.id, originalName: STAFF_ATTACHMENT_NAME }] } });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          ticketOwnerId: null,
          itPriority: "MEDIUM",
          currentStatus: "IN_PROGRESS",
          resolutionSummary: null,
          resolvedAt: null,
          closedAt: null,
          requesterResolvedAt: null,
          requesterResolvedById: null,
          lastStatusReason: null,
          version: 1,
        },
      });
      await tx.attachment.create({
        data: {
          ticketId: ticket.id,
          originalName: STAFF_ATTACHMENT_NAME,
          storageKey: STAFF_ATTACHMENT_KEY,
          mimeType: "application/pdf",
          sizeBytes: STAFF_ATTACHMENT_BYTES.byteLength,
        },
      });
    });

    const storageDirectory = path.resolve(process.env.TEST_ATTACHMENT_STORAGE_DIR ?? path.join(process.cwd(), "..", "e2e", ".tmp", "attachments"));
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(path.join(storageDirectory, `${STAFF_ATTACHMENT_KEY}.pdf`), STAFF_ATTACHMENT_BYTES);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "E2E Requester provisioning failed.");
    process.exitCode = 1;
  });
