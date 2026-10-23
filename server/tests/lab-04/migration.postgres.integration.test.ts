import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 4 forward migration PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let sentinelTicketId: number | undefined;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (sentinelTicketId) {
      await prisma.ticket.delete({ where: { id: sentinelTicketId } }).catch(() => undefined);
    }
    await prisma?.$disconnect();
  });

  it("preserves Labs 1-3 relations and adds the workflow-cycle/action/audit schema", async () => {
    const [requester, staff, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findFirst({ where: { role: "REQUESTER", isActive: true }, orderBy: { id: "asc" } }),
      prisma.requesterUser.findFirst({ where: { role: "IT_STAFF", isActive: true }, orderBy: { id: "asc" } }),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!requester || !staff || !category || !relatedSystem) {
      throw new Error("Lab 4 migration integration requires existing Lab 3 fixtures.");
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-MIG-${Date.now()}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Lab 4 migration preservation fixture",
        description: "Representative Ticket that must keep Labs 1-3 relations after the additive migration.",
        requestedPriority: "MEDIUM",
        itPriority: "HIGH",
        currentStatus: "IN_PROGRESS",
        version: 4,
        clientRequestId: randomUUID(),
        requestPayloadHash: "a".repeat(64),
      },
    });
    sentinelTicketId = ticket.id;
    expect(ticket.workflowCycle).toBe(1);

    const comment = await prisma.publicComment.create({
      data: { ticketId: ticket.id, authorId: requester.id, content: "Preserved Lab 3 public comment." },
    });
    const note = await prisma.internalNote.create({
      data: { ticketId: ticket.id, authorId: staff.id, content: "Preserved Lab 3 internal note." },
    });
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        originalName: "lab4-migration-preserved.txt",
        storageKey: randomUUID(),
        mimeType: "text/plain",
        sizeBytes: 32,
      },
    });
    const action = await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        workflowCycle: ticket.workflowCycle,
        performedById: staff.id,
        assigneeId: staff.id,
        description: "Collect migration verification evidence.",
        result: null,
        followUpRequired: false,
        status: "IN_PROGRESS",
        clientRequestId: randomUUID(),
        requestPayloadHash: "b".repeat(64),
      },
    });
    const event = await prisma.actionTakenEvent.create({
      data: {
        actionId: action.id,
        actorId: staff.id,
        eventType: "CREATED",
        resultingVersion: 1,
        changedFields: ["description", "status"],
        toStatus: "IN_PROGRESS",
        nextAssigneeId: staff.id,
      },
    });

    await expect(prisma.publicComment.findUnique({ where: { id: comment.id } })).resolves.toMatchObject({ ticketId: ticket.id });
    await expect(prisma.internalNote.findUnique({ where: { id: note.id } })).resolves.toMatchObject({ ticketId: ticket.id });
    await expect(prisma.attachment.findUnique({ where: { id: attachment.id } })).resolves.toMatchObject({ ticketId: ticket.id });
    await expect(prisma.actionTaken.findUnique({ where: { id: action.id } })).resolves.toMatchObject({
      ticketId: ticket.id,
      workflowCycle: 1,
      performedById: staff.id,
      version: 1,
    });
    await expect(prisma.actionTakenEvent.findUnique({ where: { id: event.id } })).resolves.toMatchObject({
      actionId: action.id,
      actorId: staff.id,
      resultingVersion: 1,
    });
  });
});
