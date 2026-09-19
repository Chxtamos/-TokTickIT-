import { randomUUID } from "node:crypto";
import type { PrismaClient, TicketStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lockAccountSafety } from "../../src/account-safety-lock.js";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession, testClientOrigin } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Issue #60 Staff workflow PostgreSQL concurrency", () => {
  let prisma: PrismaClient;
  let requesterId: number;
  let staffAId: number;
  let staffBId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let auth: Awaited<ReturnType<typeof createTestSession>>;
  let staffBAuth: Awaited<ReturnType<typeof createTestSession>>;
  const createdUserIds: number[] = [];
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Staff workflow integration requires active reference fixtures.");
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    const [requester, staffA, staffB] = await Promise.all([
      createProvisionedTestUser(prisma, "REQUESTER", "Workflow Requester"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Workflow Staff A"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Workflow Staff B"),
    ]);
    requesterId = requester.id;
    staffAId = staffA.id;
    staffBId = staffB.id;
    createdUserIds.push(requesterId, staffAId, staffBId);
    [auth, staffBAuth] = await Promise.all([
      createTestSession(prisma, staffAId),
      createTestSession(prisma, staffBId),
    ]);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdRequestIds.length) await prisma.ticket.deleteMany({ where: { clientRequestId: { in: createdRequestIds } } });
    if (createdUserIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function createTicket(status: TicketStatus = "IN_PROGRESS", ownerId: number | null = null) {
    const clientRequestId = randomUUID();
    createdRequestIds.push(clientRequestId);
    return prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2099-${randomUUID().slice(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        ticketOwnerId: ownerId,
        summary: "Issue 60 PostgreSQL workflow fixture",
        description: "A guarded isolated-database fixture for Staff workflow concurrency tests.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: status,
        version: 1,
        resolutionSummary: status === "RESOLVED" || status === "CLOSED" ? "Stored verified resolution." : null,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
        closedAt: status === "CLOSED" ? new Date() : null,
        requesterResolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
        requesterResolvedById: status === "RESOLVED" || status === "CLOSED" ? requesterId : null,
        clientRequestId,
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      },
    });
  }

  function api(session = auth) {
    const app = createApp(prisma);
    const authenticated = (call: request.Test) => call.set("Cookie", session.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", session.csrfToken);
    return {
      post: (path: string) => authenticated(request(app).post(path)),
      patch: (path: string) => authenticated(request(app).patch(path)),
    };
  }

  it("persists ASSIGNED/REASSIGNED provenance atomically with owner versions", async () => {
    const claimedTicket = await createTicket("OPEN");
    const claimed = await api().post(`/api/staff/tickets/${claimedTicket.id}/claim`).send({ expectedVersion: 1 });
    expect(claimed.status).toBe(200);
    expect(claimed.body).toMatchObject({ ticketOwner: { id: staffAId }, currentStatus: "OPEN", version: 2 });
    const claimNoOp = await api().post(`/api/staff/tickets/${claimedTicket.id}/claim`).send({ expectedVersion: 2 });
    expect(claimNoOp.status).toBe(200);
    expect(claimNoOp.body.version).toBe(2);
    const claimConflict = await api(staffBAuth).post(`/api/staff/tickets/${claimedTicket.id}/claim`).send({ expectedVersion: 2 });
    expect(claimConflict.status).toBe(409);
    expect(claimConflict.body.error.code).toBe("OWNER_CONFLICT");
    const claimEvents = await prisma.ticketOwnerChange.findMany({ where: { ticketId: claimedTicket.id } });
    expect(claimEvents).toEqual([
      expect.objectContaining({ previousOwnerId: null, nextOwnerId: staffAId, actorId: staffAId, reason: "ASSIGNED" }),
    ]);

    const ticket = await createTicket("OPEN");
    const assigned = await api().patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ticketOwnerId: staffBId, expectedVersion: 1 });
    expect(assigned.status).toBe(200);
    expect(assigned.body).toMatchObject({ ticketOwner: { id: staffBId }, version: 2 });

    const reassigned = await api().patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ticketOwnerId: staffAId, expectedVersion: 2 });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body).toMatchObject({ ticketOwner: { id: staffAId }, version: 3 });

    const [saved, events] = await Promise.all([
      prisma.ticket.findUnique({ where: { id: ticket.id } }),
      prisma.ticketOwnerChange.findMany({ where: { ticketId: ticket.id }, orderBy: { id: "asc" } }),
    ]);
    expect(saved).toMatchObject({ ticketOwnerId: staffAId, version: 3, currentStatus: "OPEN" });
    expect(events).toEqual([
      expect.objectContaining({ previousOwnerId: null, nextOwnerId: staffBId, actorId: staffAId, reason: "ASSIGNED" }),
      expect.objectContaining({ previousOwnerId: staffBId, nextOwnerId: staffAId, actorId: staffAId, reason: "REASSIGNED" }),
    ]);
  });

  it("allows one of competing owner/priority/status writes and leaves no partial loser effects", async () => {
    const ticket = await createTicket("IN_PROGRESS");
    const client = api();
    const results = await Promise.all([
      client.patch(`/api/staff/tickets/${ticket.id}/owner`).send({ ticketOwnerId: staffBId, expectedVersion: 1 }),
      client.patch(`/api/staff/tickets/${ticket.id}/it-priority`).send({ itPriority: "URGENT", expectedVersion: 1 }),
      client.patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "RESOLVED", expectedVersion: 1, resolutionSummary: "Resolved by the concurrency winner." }),
    ]);
    expect(results.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(results.filter(({ status, body }) => status === 409 && body.error.code === "VERSION_CONFLICT")).toHaveLength(2);

    const [saved, events] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      prisma.ticketOwnerChange.findMany({ where: { ticketId: ticket.id } }),
    ]);
    expect(saved.version).toBe(2);
    const winner = results.findIndex(({ status }) => status === 200);
    if (winner === 0) {
      expect(saved).toMatchObject({ ticketOwnerId: staffBId, itPriority: "MEDIUM", currentStatus: "IN_PROGRESS", resolutionSummary: null });
      expect(events).toHaveLength(1);
    } else if (winner === 1) {
      expect(saved).toMatchObject({ ticketOwnerId: null, itPriority: "URGENT", currentStatus: "IN_PROGRESS", resolutionSummary: null });
      expect(events).toHaveLength(0);
    } else {
      expect(saved).toMatchObject({ ticketOwnerId: null, itPriority: "MEDIUM", currentStatus: "RESOLVED", resolutionSummary: "Resolved by the concurrency winner." });
      expect(saved.resolvedAt).toBeInstanceOf(Date);
      expect(events).toHaveLength(0);
    }
  });

  it("persists resolve/close/reopen timestamps and clears the prior work-cycle indication", async () => {
    const ticket = await createTicket("IN_PROGRESS");
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { requesterResolvedAt: new Date(), requesterResolvedById: requesterId },
    });
    const resolved = await api().patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "RESOLVED", expectedVersion: 1, resolutionSummary: "A complete real database resolution." });
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedAt).toEqual(expect.any(String));

    const closed = await api().patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "CLOSED", expectedVersion: 2 });
    expect(closed.status).toBe(200);
    expect(closed.body.closedAt).toEqual(expect.any(String));

    const reopened = await api().patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "REOPENED", expectedVersion: 3, reason: "The incident recurred." });
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({
      version: 4,
      lastStatusReason: "The incident recurred.",
      resolutionSummary: null,
      resolvedAt: null,
      closedAt: null,
      requesterResolvedAt: null,
      requesterResolvedBy: null,
    });
  });

  it("uses the shared account-safety lock and rechecks eligibility after a serialized account change", async () => {
    const ticket = await createTicket("OPEN");
    let signalLocked!: () => void;
    let allowAccountChange!: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const proceed = new Promise<void>((resolve) => { allowAccountChange = resolve; });

    const simulatedIssue63 = prisma.$transaction(async (tx) => {
      await lockAccountSafety(tx, staffBId);
      signalLocked();
      await proceed;
      await tx.requesterUser.update({ where: { id: staffBId }, data: { isActive: false } });
    });
    await locked;

    let assignmentSettled = false;
    const assignment = api().patch(`/api/staff/tickets/${ticket.id}/owner`)
      .send({ ticketOwnerId: staffBId, expectedVersion: 1 })
      .then((response) => {
        assignmentSettled = true;
        return response;
      });
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(assignmentSettled).toBe(false);
    allowAccountChange();
    await simulatedIssue63;
    const response = await assignment;
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("ASSIGNEE_INVALID");

    const [saved, events] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      prisma.ticketOwnerChange.findMany({ where: { ticketId: ticket.id } }),
    ]);
    expect(saved).toMatchObject({ ticketOwnerId: null, version: 1 });
    expect(events).toHaveLength(0);
    await prisma.requesterUser.update({ where: { id: staffBId }, data: { isActive: true } });
  });
});
