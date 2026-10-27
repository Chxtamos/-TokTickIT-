import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient, TicketStatus } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 4 Requester Dashboard API", () => {
  let prisma: PrismaClient;
  let requesterId: number;
  let otherRequesterId: number;
  let staffId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let requesterAuth: Awaited<ReturnType<typeof createTestSession>>;
  let staffAuth: Awaited<ReturnType<typeof createTestSession>>;
  const createdTicketIds: number[] = [];
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system, requester, other, staff] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      createProvisionedTestUser(prisma, "REQUESTER", "Requester Dashboard Owner"),
      createProvisionedTestUser(prisma, "REQUESTER", "Requester Dashboard Other"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Requester Dashboard Staff"),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    requesterId = requester.id;
    otherRequesterId = other.id;
    staffId = staff.id;
    createdUserIds.push(requesterId, otherRequesterId, staffId);
    [requesterAuth, staffAuth] = await Promise.all([createTestSession(prisma, requesterId), createTestSession(prisma, staffId)]);

    const createTicket = async (ownerRequesterId: number, status: TicketStatus, updatedAt: Date, resolvedAt: Date | null = null) => {
      const ticket = await prisma.ticket.create({ data: {
        ticketNumber: `TKT-L4-REQ-${randomUUID().slice(0, 8)}`,
        requesterId: ownerRequesterId,
        categoryId,
        relatedSystemId,
        summary: `${status} requester dashboard fixture`,
        description: "Representative Ticket for Requester Dashboard ownership and ordering verification.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: status,
        resolutionSummary: resolvedAt ? "Resolved fixture summary." : null,
        resolvedAt,
        closedAt: status === "CLOSED" ? resolvedAt : null,
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        createdAt: updatedAt,
        updatedAt,
      } });
      createdTicketIds.push(ticket.id);
      return ticket;
    };

    await createTicket(requesterId, "OPEN", new Date("2099-03-05T00:00:00.000Z"));
    await createTicket(requesterId, "WAITING_FOR_REQUESTER", new Date("2099-03-04T00:00:00.000Z"));
    await createTicket(requesterId, "IN_PROGRESS", new Date("2099-03-03T00:00:00.000Z"));
    await createTicket(requesterId, "RESOLVED", new Date("2099-03-02T00:00:00.000Z"), new Date("2099-03-02T12:00:00.000Z"));
    await createTicket(requesterId, "CLOSED", new Date("2099-03-01T00:00:00.000Z"), new Date("2099-03-03T12:00:00.000Z"));
    await createTicket(otherRequesterId, "WAITING_FOR_REQUESTER", new Date("2100-01-01T00:00:00.000Z"));
    await createTicket(otherRequesterId, "RESOLVED", new Date("2100-01-02T00:00:00.000Z"), new Date("2100-01-02T12:00:00.000Z"));
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdTicketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    if (createdUserIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  const get = (session: Awaited<ReturnType<typeof createTestSession>>, path = "/api/requester/dashboard") => request(createApp(prisma)).get(path).set("Cookie", session.cookie);

  it("returns only authenticated Requester-owned authoritative metrics and bounded recent lists", async () => {
    const response = await get(requesterAuth);
    expect(response.status).toBe(200);
    const [openTickets, waitingForRequester, recentlyUpdated, recentlyResolved] = await Promise.all([
      prisma.ticket.count({ where: { requesterId, currentStatus: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
      prisma.ticket.count({ where: { requesterId, currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.findMany({ where: { requesterId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } }),
      prisma.ticket.findMany({ where: { requesterId, currentStatus: { in: ["RESOLVED", "CLOSED"] } }, orderBy: [{ resolvedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } }),
    ]);
    expect(response.body.metrics).toEqual({ openTickets, waitingForRequester });
    expect(response.body.recentlyUpdated.map((ticket: { id: number }) => ticket.id)).toEqual(recentlyUpdated.map(({ id }) => id));
    expect(response.body.recentlyResolved.map((ticket: { id: number }) => ticket.id)).toEqual(recentlyResolved.map(({ id }) => id));
    expect(response.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(response.body.recentlyResolved.length).toBeLessThanOrEqual(5);
    const visibleIds = new Set([...response.body.recentlyUpdated, ...response.body.recentlyResolved].map((ticket: { id: number }) => ticket.id));
    const otherIds = await prisma.ticket.findMany({ where: { requesterId: otherRequesterId }, select: { id: true } });
    for (const ticket of otherIds) expect(visibleIds.has(ticket.id)).toBe(false);
    expect(response.body.drillDown).toEqual({
      openTickets: "/my-tickets?state=open",
      waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER",
    });
  });

  it("forbids Staff and rejects all query parameters including requesterId", async () => {
    const forbidden = await get(staffAuth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("ROLE_FORBIDDEN");
    const invalid = await get(requesterAuth, `/api/requester/dashboard?requesterId=${otherRequesterId}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");
  });
});
