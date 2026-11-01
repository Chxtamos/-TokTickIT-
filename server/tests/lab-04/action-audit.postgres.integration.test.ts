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

integration("Lab 4 Action audit PostgreSQL atomicity", () => {
  let prisma: PrismaClient;
  let requesterId: number;
  let staffAId: number;
  let staffBId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let authA: Awaited<ReturnType<typeof createTestSession>>;
  let authB: Awaited<ReturnType<typeof createTestSession>>;
  const ticketIds: number[] = [];
  const userIds: number[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system, requester, staffA, staffB] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      createProvisionedTestUser(prisma, "REQUESTER", "Audit Requester"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Audit Staff A"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Audit Staff B"),
    ]);
    categoryId = category.id;
    relatedSystemId = system.id;
    requesterId = requester.id;
    staffAId = staffA.id;
    staffBId = staffB.id;
    userIds.push(requesterId, staffAId, staffBId);
    [authA, authB] = await Promise.all([
      createTestSession(prisma, staffAId),
      createTestSession(prisma, staffBId),
    ]);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (ticketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    if (userIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  function api(auth: Awaited<ReturnType<typeof createTestSession>>) {
    const app = createApp(prisma);
    return {
      post: (path: string) => request(app).post(path).set("Cookie", auth.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", auth.csrfToken),
      patch: (path: string) => request(app).patch(path).set("Cookie", auth.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", auth.csrfToken),
    };
  }

  async function createTicket() {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-AUDIT-${randomUUID().slice(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        ticketOwnerId: staffAId,
        summary: "Action audit atomicity",
        description: "Real PostgreSQL fixture for Action/event transaction atomicity.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "IN_PROGRESS",
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      },
    });
    ticketIds.push(ticket.id);
    return ticket;
  }

  async function createAction(ticketId: number) {
    const response = await api(authA).post(`/api/staff/tickets/${ticketId}/actions`).send({
      clientRequestId: randomUUID(),
      description: "Audit fixture Action.",
      result: null,
      assigneeId: staffAId,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    });
    expect(response.status).toBe(201);
    return response.body.action as { id: number };
  }

  it("commits the matching mutation event with the real actor and resulting version", async () => {
    const ticket = await createTicket();
    const action = await createAction(ticket.id);
    const updated = await api(authB).patch(`/api/staff/tickets/${ticket.id}/actions/${action.id}`).send({
      expectedVersion: 1,
      assigneeId: staffBId,
      description: "Updated by the second Staff member.",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.action).toMatchObject({ version: 2, assignee: { id: staffBId }, performedBy: { id: staffAId } });
    await expect(prisma.actionTakenEvent.findUnique({
      where: { actionId_resultingVersion: { actionId: action.id, resultingVersion: 2 } },
    })).resolves.toMatchObject({
      actorId: staffBId,
      eventType: "ASSIGNED",
      resultingVersion: 2,
      previousAssigneeId: staffAId,
      nextAssigneeId: staffBId,
    });
  });

  it("rolls the Action mutation back when the matching audit event cannot commit", async () => {
    const ticket = await createTicket();
    const action = await createAction(ticket.id);
    await prisma.actionTakenEvent.create({
      data: {
        actionId: action.id,
        actorId: staffAId,
        eventType: "UPDATED",
        resultingVersion: 2,
        changedFields: [],
      },
    });

    const failed = await api(authB).patch(`/api/staff/tickets/${ticket.id}/actions/${action.id}`).send({
      expectedVersion: 1,
      status: "IN_PROGRESS",
    });
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe("ACTION_UPDATE_FAILED");

    await expect(prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).resolves.toMatchObject({
      version: 1,
      status: "PENDING",
      assigneeId: staffAId,
    });
    await expect(prisma.actionTakenEvent.count({ where: { actionId: action.id } })).resolves.toBe(2);
  });
});
