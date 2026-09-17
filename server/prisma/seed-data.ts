import { createHash } from "node:crypto";
import type { PrismaClient, RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
import { hashPassword, validatePasswordInput } from "../src/password.js";

export const lab2Categories = ["Account and Access", "Hardware", "Software", "Network"];

export const lab2RelatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

export const lab2Requesters = [
  { name: "Anan Srisuk", email: "anan.srisuk@example.test", isActive: true },
  { name: "Benjamas Kittipong", email: "benjamas.kittipong@example.test", isActive: true },
  { name: "Chaiwat Somchai", email: "chaiwat.somchai@example.test", isActive: true },
  { name: "Daranee Ploy", email: "daranee.ploy@example.test", isActive: true },
  { name: "Inactive Requester", email: "inactive.requester@example.test", isActive: false },
];

export async function seedLab2ReferenceData(prisma: PrismaClient) {
  for (const name of lab2Categories) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of lab2RelatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of lab2Requesters) {
    const email = requester.email.trim().toLowerCase();
    await prisma.requesterUser.upsert({
      where: { email },
      update: { name: requester.name, isActive: requester.isActive },
      create: { ...requester, email },
    });
  }
}

const lab3StaffFixtures: Array<{ name: string; email: string; role: UserRole; isActive: boolean }> = [
  { name: "Support One", email: "support.one@example.test", role: "IT_STAFF", isActive: true },
  { name: "Support Two", email: "support.two@example.test", role: "IT_STAFF", isActive: true },
  { name: "Support Three", email: "support.three@example.test", role: "IT_STAFF", isActive: true },
  { name: "Inactive Support", email: "inactive.support@example.test", role: "IT_STAFF", isActive: false },
  { name: "TokTickIT Administrator", email: "admin@example.test", role: "ADMINISTRATOR", isActive: true },
];

const ticketStatuses: TicketStatus[] = [
  "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
];
const priorities: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function payloadHash(input: object): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function seedLab3Fixtures(prisma: PrismaClient) {
  const initialPassword = process.env.LAB_SEED_INITIAL_PASSWORD;
  const existingStaff = await prisma.requesterUser.findMany({
    where: { email: { in: lab3StaffFixtures.map((fixture) => fixture.email) } },
    select: { email: true, passwordHash: true },
  });
  const missingFixture = lab3StaffFixtures.some((fixture) => !existingStaff.some((user) => user.email === fixture.email));
  if (missingFixture && !initialPassword) {
    throw new Error("LAB_SEED_INITIAL_PASSWORD is required to create Lab 3 fixture accounts.");
  }
  if (initialPassword && validatePasswordInput(initialPassword).length > 0) {
    throw new Error("LAB_SEED_INITIAL_PASSWORD does not satisfy the local password policy.");
  }
  const fixtureHash = initialPassword ? await hashPassword(initialPassword) : undefined;

  for (const fixture of lab3StaffFixtures) {
    await prisma.requesterUser.upsert({
      where: { email: fixture.email },
      update: { name: fixture.name, role: fixture.role, isActive: fixture.isActive },
      create: {
        name: fixture.name,
        email: fixture.email,
        role: fixture.role,
        isActive: fixture.isActive,
        passwordHash: fixtureHash,
        mustChangePassword: true,
      },
    });
  }

  const requesters = await prisma.requesterUser.findMany({
    where: { role: "REQUESTER" },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  const owners = await prisma.requesterUser.findMany({
    where: { role: { in: ["IT_STAFF", "ADMINISTRATOR"] }, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } });
  const systems = await prisma.relatedSystem.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (requesters.length < 5 || owners.length < 4 || categories.length === 0 || systems.length === 0) {
    throw new Error("Lab 3 seed requires migrated Requesters, eligible owners and active reference data.");
  }

  for (let index = 0; index < 24; index += 1) {
    const status = ticketStatuses[index % ticketStatuses.length];
    const priority = priorities[index % priorities.length];
    const requester = requesters[index % requesters.length];
    const owner = index % 3 === 0 ? null : owners[index % owners.length];
    const ticketNumber = `TKT-2026-${String(900001 + index).padStart(6, "0")}`;
    const summary = `Seeded Lab 3 Ticket ${String(index + 1).padStart(2, "0")}`;
    const description = "Synthetic local-lab workflow fixture. No sensitive information.";
    const resolutionSummary = status === "RESOLVED" || status === "CLOSED"
      ? "Synthetic support resolution recorded for the Lab 3 fixture."
      : null;
    const reason = status === "REOPENED" || status === "CANCELLED"
      ? "Synthetic workflow fixture reason."
      : null;
    const created = await prisma.ticket.upsert({
      where: { ticketNumber },
      update: {},
      create: {
        ticketNumber,
        requesterId: requester.id,
        categoryId: categories[index % categories.length].id,
        relatedSystemId: systems[index % systems.length].id,
        ticketOwnerId: owner?.id ?? null,
        summary,
        description,
        requestedPriority: priority,
        itPriority: priority,
        currentStatus: status,
        version: 1,
        resolutionSummary,
        lastStatusReason: reason,
        clientRequestId: stableUuid(`lab3-ticket-${index}`),
        requestPayloadHash: payloadHash({ ticketNumber, requesterId: requester.id, summary, priority }),
      },
    });

    const publicContent = `Public fixture comment for ${created.ticketNumber}.`;
    const existingComment = await prisma.publicComment.findFirst({ where: { ticketId: created.id, content: publicContent } });
    if (!existingComment) {
      await prisma.publicComment.create({ data: { ticketId: created.id, authorId: requester.id, content: publicContent } });
    }
    const noteAuthor = owner ?? owners[0];
    const noteContent = `Internal fixture note for ${created.ticketNumber}.`;
    const existingNote = await prisma.internalNote.findFirst({ where: { ticketId: created.id, content: noteContent } });
    if (!existingNote) {
      await prisma.internalNote.create({ data: { ticketId: created.id, authorId: noteAuthor.id, content: noteContent } });
    }
  }

  const highestReservedNumber = 900024;
  await prisma.$executeRaw`SELECT setval('"TicketNumberSequence"', GREATEST((SELECT last_value FROM "TicketNumberSequence"), ${highestReservedNumber}), true)`;
}
