import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient, RequestedPriority, TicketStatus } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;
const terminal: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];

integration("Lab 4 Staff Dashboard API", () => {
  let prisma: PrismaClient;
  let staffId: number;
  let adminId: number;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let staffAuth: Awaited<ReturnType<typeof createTestSession>>;
  let adminAuth: Awaited<ReturnType<typeof createTestSession>>;
  let requesterAuth: Awaited<ReturnType<typeof createTestSession>>;
  const createdTicketIds: number[] = [];
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system, staff, admin, requester] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      createProvisionedTestUser(prisma, "IT_STAFF", "Lab 4 Dashboard Staff"),
      createProvisionedTestUser(prisma, "ADMINISTRATOR", "Lab 4 Dashboard Admin"),
      createProvisionedTestUser(prisma, "REQUESTER", "Lab 4 Dashboard Requester"),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    staffId = staff.id;
    adminId = admin.id;
    requesterId = requester.id;
    createdUserIds.push(staffId, adminId, requesterId);
    [staffAuth, adminAuth, requesterAuth] = await Promise.all([
      createTestSession(prisma, staffId), createTestSession(prisma, adminId), createTestSession(prisma, requesterId),
    ]);

    const createTicket = async (status: TicketStatus, priority: RequestedPriority, ownerId: number | null) => {
      const ticket = await prisma.ticket.create({ data: {
        ticketNumber: `TKT-L4-DASH-${randomUUID().slice(0, 8)}`,
        requesterId, categoryId, relatedSystemId, ticketOwnerId: ownerId,
        summary: `Dashboard ${status} ${priority}`,
        description: "Representative Ticket for authoritative Staff Dashboard calculations.",
        requestedPriority: "MEDIUM", itPriority: priority, currentStatus: status,
        clientRequestId: randomUUID(), requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      } });
      createdTicketIds.push(ticket.id);
      return ticket;
    };
    const ownedUrgent = await createTicket("IN_PROGRESS", "URGENT", staffId);
    await createTicket("OPEN", "LOW", null);
    await createTicket("WAITING_FOR_REQUESTER", "HIGH", staffId);
    await createTicket("CLOSED", "URGENT", staffId);
    await prisma.actionTaken.create({ data: {
      ticketId: ownedUrgent.id, workflowCycle: 1, performedById: staffId, assigneeId: staffId,
      description: "Dashboard open action assigned to current Staff user.", result: null,
      followUpRequired: false, followUpNote: null, attachmentNotes: null, status: "PENDING",
      clientRequestId: randomUUID(), requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"), version: 1,
    } });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdTicketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    if (createdUserIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  const get = (session: Awaited<ReturnType<typeof createTestSession>>, path = "/api/staff/dashboard") => request(createApp(prisma)).get(path).set("Cookie", session.cookie);

  it("returns backend-authoritative Staff metrics, distributions and bounded lists", async () => {
    const response = await get(staffAuth);
    expect(response.status).toBe(200);

    const [unassignedTickets, myTickets, myOpenActions, statuses, priorities] = await Promise.all([
      prisma.ticket.count({ where: { ticketOwnerId: null, currentStatus: { notIn: terminal } } }),
      prisma.ticket.count({ where: { ticketOwnerId: staffId, currentStatus: { notIn: terminal } } }),
      prisma.actionTaken.count({ where: { assigneeId: staffId, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["itPriority"], where: { currentStatus: { notIn: terminal } }, _count: { _all: true } }),
    ]);
    expect(response.body.metrics).toEqual({ unassignedTickets, myTickets, myOpenActions });
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const) {
      expect(response.body.byStatus[status]).toBe(statuses.find((row) => row.currentStatus === status)?._count._all ?? 0);
    }
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"] as const) {
      expect(response.body.byItPriority[priority]).toBe(priorities.find((row) => row.itPriority === priority)?._count._all ?? 0);
    }
    expect(response.body.recentOrUrgent.length).toBeLessThanOrEqual(10);
    expect(response.body.myRecentActions.length).toBeLessThanOrEqual(5);
    expect(response.body.myRecentActions.some((action: { assignee: { id: number } | null }) => action.assignee?.id === staffId)).toBe(true);
    expect(response.body.drillDown).toMatchObject({
      unassignedTickets: "/staff/tickets?owner=unassigned",
      myTickets: "/staff/tickets?owner=mine",
    });
  });

  it("allows Administrator reuse, forbids Requesters, and rejects unsupported query parameters", async () => {
    expect((await get(adminAuth)).status).toBe(200);
    const forbidden = await get(requesterAuth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("ROLE_FORBIDDEN");
    const invalid = await get(staffAuth, "/api/staff/dashboard?include=all");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");
  });
});
