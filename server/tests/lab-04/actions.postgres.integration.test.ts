import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession, testClientOrigin } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 4 Action/Ticket PostgreSQL concurrency", () => {
  let prisma: PrismaClient;
  let requesterId: number;
  let staffId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let auth: Awaited<ReturnType<typeof createTestSession>>;
  const ticketIds: number[] = [];
  const userIds: number[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system, requester, staff] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      createProvisionedTestUser(prisma, "REQUESTER", "Action Race Requester"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Action Race Staff"),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    requesterId = requester.id;
    staffId = staff.id;
    userIds.push(requesterId, staffId);
    auth = await createTestSession(prisma, staffId);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (ticketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    if (userIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  function api() {
    const app = createApp(prisma);
    return {
      post: (path: string) => request(app).post(path).set("Cookie", auth.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", auth.csrfToken),
      patch: (path: string) => request(app).patch(path).set("Cookie", auth.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", auth.csrfToken),
    };
  }

  async function createTicket() {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-RACE-${randomUUID().slice(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        ticketOwnerId: staffId,
        summary: "Action/Ticket parent lock race",
        description: "Real PostgreSQL fixture for parent/child serialization.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "IN_PROGRESS",
        version: 1,
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      },
    });
    ticketIds.push(ticket.id);
    return ticket;
  }

  function actionBody() {
    return {
      clientRequestId: randomUUID(),
      description: "Concurrent Action mutation against Ticket resolution.",
      result: null,
      assigneeId: staffId,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    };
  }

  function resolveBody(expectedVersion = 1) {
    return {
      currentStatus: "RESOLVED",
      expectedVersion,
      resolutionSummary: "Resolution must observe serialized current-cycle Action state.",
    };
  }

  it("serializes a concurrent Action create against Ticket resolution", async () => {
    const ticket = await createTicket();
    const [created, resolved] = await Promise.all([
      api().post(`/api/staff/tickets/${ticket.id}/actions`).send(actionBody()),
      api().patch(`/api/staff/tickets/${ticket.id}/status`).send(resolveBody()),
    ]);
    expect(created.status).toBe(201);
    expect(resolved.status).toBe(409);
    expect(resolved.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");
    const [savedTicket, actions] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      prisma.actionTaken.findMany({ where: { ticketId: ticket.id } }),
    ]);
    expect(savedTicket.currentStatus).toBe("IN_PROGRESS");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ status: "PENDING", workflowCycle: 1 });
  });

  it("serializes Action completion against resolution so no invalid resolved/non-terminal state can commit", async () => {
    const ticket = await createTicket();
    const created = await api().post(`/api/staff/tickets/${ticket.id}/actions`).send(actionBody());
    expect(created.status).toBe(201);
    const actionId = created.body.action.id as number;

    const [completed, resolved] = await Promise.all([
      api().patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
        expectedVersion: 1,
        status: "COMPLETED",
        result: "Concurrent completion produced valid resolution evidence.",
      }),
      api().patch(`/api/staff/tickets/${ticket.id}/status`).send(resolveBody()),
    ]);
    expect(completed.status).toBe(200);
    expect([200, 409]).toContain(resolved.status);
    if (resolved.status === 409) expect(resolved.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");

    const [savedTicket, savedAction] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } }),
    ]);
    expect(savedAction.status).toBe("COMPLETED");
    if (savedTicket.currentStatus === "RESOLVED") {
      expect(savedAction.result).toBe("Concurrent completion produced valid resolution evidence.");
    } else {
      expect(savedTicket.currentStatus).toBe("IN_PROGRESS");
      expect(resolved.status).toBe(409);
    }
  });
});
