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

integration("Lab 4 workflow-cycle PostgreSQL race", () => {
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
      createProvisionedTestUser(prisma, "REQUESTER", "Cycle Race Requester"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Cycle Race Staff"),
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

  it("increments the cycle on reopen, rejects old-cycle evidence, and serializes new-cycle completion against resolve", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-CYCLE-${randomUUID().slice(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId,
        ticketOwnerId: staffId,
        summary: "Reopened workflow-cycle race",
        description: "Real PostgreSQL fixture for reopened-cycle resolution concurrency.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "CLOSED",
        workflowCycle: 1,
        version: 1,
        resolutionSummary: "Previously verified resolution.",
        resolvedAt: new Date(),
        closedAt: new Date(),
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      },
    });
    ticketIds.push(ticket.id);
    await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        workflowCycle: 1,
        performedById: staffId,
        assigneeId: staffId,
        description: "Prior-cycle completed evidence.",
        result: "Prior-cycle result must not satisfy the reopened cycle.",
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        status: "COMPLETED",
        clientRequestId: randomUUID(),
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        version: 1,
      },
    });

    const reopened = await api().patch(`/api/staff/tickets/${ticket.id}/status`).send({
      currentStatus: "REOPENED",
      expectedVersion: 1,
      reason: "Issue recurred after closure.",
    });
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ currentStatus: "REOPENED", version: 2 });
    await expect(prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      select: { workflowCycle: true },
    })).resolves.toEqual({ workflowCycle: 2 });

    const inProgress = await api().patch(`/api/staff/tickets/${ticket.id}/status`).send({
      currentStatus: "IN_PROGRESS",
      expectedVersion: 2,
    });
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.version).toBe(3);

    const oldOnly = await api().patch(`/api/staff/tickets/${ticket.id}/status`).send({
      currentStatus: "RESOLVED",
      expectedVersion: 3,
      resolutionSummary: "Old-cycle evidence must not permit this resolution.",
    });
    expect(oldOnly.status).toBe(409);
    expect(oldOnly.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");

    const created = await api().post(`/api/staff/tickets/${ticket.id}/actions`).send({
      clientRequestId: randomUUID(),
      description: "New-cycle Action that races completion with resolution.",
      result: null,
      assigneeId: staffId,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    });
    expect(created.status).toBe(201);
    expect(created.body.action.workflowCycle).toBe(2);
    const actionId = created.body.action.id as number;

    const [completed, resolved] = await Promise.all([
      api().patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
        expectedVersion: 1,
        status: "COMPLETED",
        result: "New-cycle completion evidence is valid.",
      }),
      api().patch(`/api/staff/tickets/${ticket.id}/status`).send({
        currentStatus: "RESOLVED",
        expectedVersion: 3,
        resolutionSummary: "Reopened cycle resolution after serialized Action work.",
      }),
    ]);
    expect(completed.status).toBe(200);
    expect([200, 409]).toContain(resolved.status);
    if (resolved.status === 409) expect(resolved.body.error.code).toBe("RESOLUTION_ACTIONS_INCOMPLETE");

    const [savedTicket, savedAction] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId } }),
    ]);
    expect(savedTicket.workflowCycle).toBe(2);
    expect(savedAction).toMatchObject({ workflowCycle: 2, status: "COMPLETED" });
    expect(savedTicket.currentStatus === "RESOLVED" || savedTicket.currentStatus === "IN_PROGRESS").toBe(true);
    if (savedTicket.currentStatus === "RESOLVED") expect(savedAction.result).toBe("New-cycle completion evidence is valid.");
  });
});
