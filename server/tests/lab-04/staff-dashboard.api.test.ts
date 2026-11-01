import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient, RequestedPriority, TicketStatus } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession } from "../helpers/auth-session.js";
import { createIsolatedPostgresTestDatabase } from "../helpers/isolated-postgres.js";

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
  let openActionId: number;
  const nonUrgentOrderingIds: number[] = [];
  const createdTicketIds: number[] = [];
  const createdUserIds: number[] = [];
  let disposeIsolatedDatabase: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const isolated = await createIsolatedPostgresTestDatabase("staff_dashboard");
    prisma = isolated.prisma;
    disposeIsolatedDatabase = isolated.dispose;
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

    const createTicket = async (status: TicketStatus, priority: RequestedPriority, ownerId: number | null, updatedAt?: Date) => {
      const ticket = await prisma.ticket.create({ data: {
        ticketNumber: `TKT-L4-DASH-${randomUUID().slice(0, 8)}`,
        requesterId, categoryId, relatedSystemId, ticketOwnerId: ownerId,
        summary: `Dashboard ${status} ${priority}`,
        description: "Representative Ticket for authoritative Staff Dashboard calculations.",
        requestedPriority: "MEDIUM", itPriority: priority, currentStatus: status,
        clientRequestId: randomUUID(), requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        ...(updatedAt ? { createdAt: updatedAt, updatedAt } : {}),
      } });
      createdTicketIds.push(ticket.id);
      return ticket;
    };
    const ownedUrgent = await createTicket("IN_PROGRESS", "URGENT", staffId);
    await createTicket("OPEN", "LOW", null);
    await createTicket("WAITING_FOR_REQUESTER", "HIGH", staffId);
    await createTicket("CLOSED", "URGENT", staffId);
    const newestLow = await createTicket("OPEN", "LOW", null, new Date("2099-01-03T00:00:00.000Z"));
    const middleMedium = await createTicket("OPEN", "MEDIUM", null, new Date("2099-01-02T00:00:00.000Z"));
    const oldestHigh = await createTicket("OPEN", "HIGH", null, new Date("2099-01-01T00:00:00.000Z"));
    nonUrgentOrderingIds.push(newestLow.id, middleMedium.id, oldestHigh.id);

    const openAction = await prisma.actionTaken.create({ data: {
      ticketId: ownedUrgent.id, workflowCycle: 1, performedById: staffId, assigneeId: staffId,
      description: "Dashboard open action assigned to current Staff user.", result: null,
      followUpRequired: false, followUpNote: null, attachmentNotes: null, status: "PENDING",
      clientRequestId: randomUUID(), requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"), version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    } });
    openActionId = openAction.id;
    for (let index = 0; index < 5; index += 1) {
      const timestamp = new Date(`2099-02-0${index + 1}T00:00:00.000Z`);
      await prisma.actionTaken.create({ data: {
        ticketId: ownedUrgent.id, workflowCycle: 1, performedById: staffId, assigneeId: adminId,
        description: `Newer completed Dashboard history ${index + 1}.`,
        result: "Completed historical work that should only affect My Recent Actions.",
        followUpRequired: false, followUpNote: null, attachmentNotes: null, status: "COMPLETED",
        clientRequestId: randomUUID(), requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"), version: 1,
        createdAt: timestamp, updatedAt: timestamp,
      } });
    }
  });

  afterAll(async () => {
    await disposeIsolatedDatabase?.();
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
    const urgentExpected = await prisma.ticket.findMany({
      where: { currentStatus: { notIn: terminal }, itPriority: "URGENT" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
      select: { id: true },
    });
    const nonUrgentExpected = urgentExpected.length < 10 ? await prisma.ticket.findMany({
      where: { currentStatus: { notIn: terminal }, itPriority: { not: "URGENT" } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10 - urgentExpected.length,
      select: { id: true },
    }) : [];
    expect(response.body.recentOrUrgent.map((ticket: { id: number }) => ticket.id)).toEqual([
      ...urgentExpected.map(({ id }) => id),
      ...nonUrgentExpected.map(({ id }) => id),
    ]);
    expect(response.body.recentOrUrgent
      .map((ticket: { id: number }) => ticket.id)
      .filter((id: number) => nonUrgentOrderingIds.includes(id)))
      .toEqual(nonUrgentOrderingIds);

    expect(response.body.myOpenActionItems.length).toBeLessThanOrEqual(10);
    expect(response.body.myOpenActionItems.some((action: { id: number }) => action.id === openActionId)).toBe(true);
    expect(response.body.myRecentActions.length).toBeLessThanOrEqual(5);
    expect(response.body.myRecentActions.some((action: { id: number }) => action.id === openActionId)).toBe(false);
    expect(response.body.drillDown).toMatchObject({
      unassignedTickets: "/staff/tickets?owner=unassigned",
      myTickets: "/staff/tickets?owner=mine",
      myOpenActions: "/staff/dashboard#my-open-actions",
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
