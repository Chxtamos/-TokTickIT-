import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActionTakenStatus, PrismaClient, TicketStatus } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession, testClientOrigin } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

const transitionMatrix: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: [],
};

integration("Lab 4 Ticket workflow API", () => {
  let prisma: PrismaClient;
  let requesterId: number;
  let staffId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let staffAuth: Awaited<ReturnType<typeof createTestSession>>;
  let requesterAuth: Awaited<ReturnType<typeof createTestSession>>;
  const createdTicketIds: number[] = [];
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system, requester, staff] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      createProvisionedTestUser(prisma, "REQUESTER", "Lab 4 Workflow Requester"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Lab 4 Workflow Staff"),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    requesterId = requester.id;
    staffId = staff.id;
    createdUserIds.push(requesterId, staffId);
    [staffAuth, requesterAuth] = await Promise.all([
      createTestSession(prisma, staffId),
      createTestSession(prisma, requesterId),
    ]);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdTicketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    if (createdUserIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  function authed(session: Awaited<ReturnType<typeof createTestSession>>) {
    const app = createApp(prisma);
    return {
      patch: (path: string) => request(app).patch(path).set("Cookie", session.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", session.csrfToken),
      post: (path: string) => request(app).post(path).set("Cookie", session.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", session.csrfToken),
    };
  }

  async function createTicket(status: TicketStatus, workflowCycle = 1) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-WF-${randomUUID().slice(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        ticketOwnerId: staffId,
        summary: `Workflow ${status}`,
        description: "Representative Lab 4 workflow Ticket used for isolated PostgreSQL API verification.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: status,
        workflowCycle,
        version: 1,
        resolutionSummary: status === "RESOLVED" || status === "CLOSED" ? "Stored valid resolution summary." : null,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
        closedAt: status === "CLOSED" ? new Date() : null,
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function createAction(ticketId: number, workflowCycle: number, status: ActionTakenStatus, result: string | null) {
    return prisma.actionTaken.create({
      data: {
        ticketId,
        workflowCycle,
        performedById: staffId,
        assigneeId: staffId,
        description: "Representative workflow evidence Action.",
        result,
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        status,
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        version: 1,
      },
    });
  }

  function statusBody(target: TicketStatus, expectedVersion = 1) {
    return {
      currentStatus: target,
      expectedVersion,
      ...(target === "RESOLVED" ? { resolutionSummary: "Verified resolution after completed current-cycle work." } : {}),
      ...((target === "REOPENED" || target === "CANCELLED") ? { reason: "Valid workflow reason." } : {}),
    };
  }

  it("enforces the contracted transition matrix", async () => {
    const allStatuses = Object.keys(transitionMatrix) as TicketStatus[];
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (from === to) continue;
        const ticket = await createTicket(from);
        if (to === "RESOLVED" && transitionMatrix[from].includes(to)) {
          await createAction(ticket.id, 1, "COMPLETED", "Current-cycle completion evidence is valid.");
        }
        const response = await authed(staffAuth).patch(`/api/staff/tickets/${ticket.id}/status`).send(statusBody(to));
        if (transitionMatrix[from].includes(to)) {
          expect(response.status, `${from} -> ${to}`).toBe(200);
        } else {
          expect(response.status, `${from} -> ${to}`).toBe(409);
          expect(response.body.error.code, `${from} -> ${to}`).toBe("STATUS_TRANSITION_INVALID");
        }
      }
    }
  }, 60_000);

  it("blocks resolution without positive completed current-cycle evidence or while current-cycle work is non-terminal", async () => {
    const zero = await createTicket("IN_PROGRESS");
    const zeroResponse = await authed(staffAuth).patch(`/api/staff/tickets/${zero.id}/status`).send(statusBody("RESOLVED"));
    expect(zeroResponse.status).toBe(409);
    expect(zeroResponse.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");

    const cancelledOnly = await createTicket("IN_PROGRESS");
    await createAction(cancelledOnly.id, 1, "CANCELLED", null);
    const cancelledResponse = await authed(staffAuth).patch(`/api/staff/tickets/${cancelledOnly.id}/status`).send(statusBody("RESOLVED"));
    expect(cancelledResponse.status).toBe(409);
    expect(cancelledResponse.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");

    const incomplete = await createTicket("WAITING_FOR_REQUESTER");
    await createAction(incomplete.id, 1, "COMPLETED", "One current-cycle Action completed successfully.");
    await createAction(incomplete.id, 1, "IN_PROGRESS", null);
    const incompleteResponse = await authed(staffAuth).patch(`/api/staff/tickets/${incomplete.id}/status`).send(statusBody("RESOLVED"));
    expect(incompleteResponse.status).toBe(409);
    expect(incompleteResponse.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");
  });

  it("resolves only from valid current-cycle terminal history and ignores older-cycle completion", async () => {
    const oldOnly = await createTicket("IN_PROGRESS", 2);
    await createAction(oldOnly.id, 1, "COMPLETED", "Old-cycle completion must not satisfy cycle two.");
    const blocked = await authed(staffAuth).patch(`/api/staff/tickets/${oldOnly.id}/status`).send(statusBody("RESOLVED"));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");

    await createAction(oldOnly.id, 2, "COMPLETED", "Current-cycle completed Action proves positive resolution work.");
    await createAction(oldOnly.id, 2, "CANCELLED", null);
    const allowed = await authed(staffAuth).patch(`/api/staff/tickets/${oldOnly.id}/status`).send(statusBody("RESOLVED"));
    expect(allowed.status).toBe(200);
    expect(allowed.body.currentStatus).toBe("RESOLVED");
  });

  it("increments workflowCycle atomically when reopening RESOLVED or CLOSED Tickets", async () => {
    for (const from of ["RESOLVED", "CLOSED"] as const) {
      const ticket = await createTicket(from, 3);
      const response = await authed(staffAuth).patch(`/api/staff/tickets/${ticket.id}/status`).send(statusBody("REOPENED"));
      expect(response.status, from).toBe(200);
      const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id }, select: { workflowCycle: true, currentStatus: true, version: true } });
      expect(saved, from).toMatchObject({ workflowCycle: 4, currentStatus: "REOPENED", version: 2 });
    }
  });

  it("keeps Requester resolution indication advisory and never changes formal status", async () => {
    const ticket = await createTicket("IN_PROGRESS");
    const response = await authed(requesterAuth).post(`/api/tickets/${ticket.id}/resolution-indication`).send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body.currentStatus).toBe("IN_PROGRESS");
    expect(response.body.requesterResolvedAt).toEqual(expect.any(String));
    const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.currentStatus).toBe("IN_PROGRESS");
    expect(saved.resolutionSummary).toBeNull();
  });

  it("rejects stale workflow writes without changing Ticket state", async () => {
    const ticket = await createTicket("OPEN");
    await prisma.ticket.update({ where: { id: ticket.id }, data: { version: 2 } });
    const response = await authed(staffAuth).patch(`/api/staff/tickets/${ticket.id}/status`).send(statusBody("IN_PROGRESS", 1));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("VERSION_CONFLICT");
    await expect(prisma.ticket.findUnique({ where: { id: ticket.id } })).resolves.toMatchObject({ currentStatus: "OPEN", version: 2 });
  });
});
