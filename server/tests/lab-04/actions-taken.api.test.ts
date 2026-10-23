import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession, testClientOrigin } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 4 Actions Taken API", () => {
  let prisma: PrismaClient;
  let requesterA: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let requesterB: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let staffA: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let staffB: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let inactiveStaff: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let admin: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let authRequesterA: Awaited<ReturnType<typeof createTestSession>>;
  let authRequesterB: Awaited<ReturnType<typeof createTestSession>>;
  let authStaffA: Awaited<ReturnType<typeof createTestSession>>;
  let authStaffB: Awaited<ReturnType<typeof createTestSession>>;
  let authAdmin: Awaited<ReturnType<typeof createTestSession>>;
  let categoryId: number;
  let systemId: number;
  const createdTicketIds: number[] = [];
  const createdUserIds: number[] = [];

  function app() {
    return createApp(prisma);
  }

  function writeAuth(auth: Awaited<ReturnType<typeof createTestSession>>) {
    return {
      post: (path: string) => request(app()).post(path).set("Cookie", auth.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", auth.csrfToken),
      patch: (path: string) => request(app()).patch(path).set("Cookie", auth.cookie).set("Origin", testClientOrigin).set("X-CSRF-Token", auth.csrfToken),
    };
  }

  async function createTicket(requesterId: number, label: string) {
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-ACT-${randomUUID().slice(0, 8)}`,
        requesterId,
        categoryId,
        relatedSystemId: systemId,
        summary: `Actions API ${label}`,
        description: "Representative Ticket for Lab 4 Actions Taken API integration coverage.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "IN_PROGRESS",
        clientRequestId: randomUUID(),
        requestPayloadHash: "d".repeat(64),
      },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  function createBody(overrides: Record<string, unknown> = {}) {
    return {
      clientRequestId: randomUUID(),
      description: "Investigate and record the current service behavior.",
      result: null,
      assigneeId: staffA.id,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
      ...overrides,
    };
  }

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    if (!category || !system) throw new Error("Lab 4 Actions API tests require seeded reference data.");
    categoryId = category.id;
    systemId = system.id;

    [requesterA, requesterB, staffA, staffB, inactiveStaff, admin] = await Promise.all([
      createProvisionedTestUser(prisma, "REQUESTER", "Actions Requester A"),
      createProvisionedTestUser(prisma, "REQUESTER", "Actions Requester B"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Actions Staff A"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Actions Staff B"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Actions Inactive Staff"),
      createProvisionedTestUser(prisma, "ADMINISTRATOR", "Actions Admin"),
    ]);
    createdUserIds.push(requesterA.id, requesterB.id, staffA.id, staffB.id, inactiveStaff.id, admin.id);
    await prisma.requesterUser.update({ where: { id: inactiveStaff.id }, data: { isActive: false } });
    [authRequesterA, authRequesterB, authStaffA, authStaffB, authAdmin] = await Promise.all([
      createTestSession(prisma, requesterA.id),
      createTestSession(prisma, requesterB.id),
      createTestSession(prisma, staffA.id),
      createTestSession(prisma, staffB.id),
      createTestSession(prisma, admin.id),
    ]);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdTicketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    for (const id of createdUserIds) await prisma.requesterUser.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("allows Requesters to read only owned Action history and keeps stable order", async () => {
    const ticket = await createTicket(requesterA.id, "requester-read");
    const first = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({ description: "First recorded support action." }));
    const second = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({ description: "Second recorded support action." }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const owned = await request(app()).get(`/api/tickets/${ticket.id}/actions`).set("Cookie", authRequesterA.cookie);
    expect(owned.status).toBe(200);
    expect(owned.body.items.map((item: { id: number }) => item.id)).toEqual([first.body.action.id, second.body.action.id]);
    expect(owned.body.items[0]).not.toHaveProperty("requestPayloadHash");

    const nonOwner = await request(app()).get(`/api/tickets/${ticket.id}/actions`).set("Cookie", authRequesterB.cookie);
    expect(nonOwner.status).toBe(404);
    expect(nonOwner.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const staffRead = await request(app()).get(`/api/tickets/${ticket.id}/actions`).set("Cookie", authAdmin.cookie);
    expect(staffRead.status).toBe(200);
    expect(staffRead.body.items).toHaveLength(2);
  });

  it("denies Requester writes and enforces CSRF before Action mutation", async () => {
    const ticket = await createTicket(requesterA.id, "write-auth");
    const anonymous = await request(app()).get(`/api/tickets/${ticket.id}/actions`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("SESSION_REQUIRED");

    const requesterDenied = await writeAuth(authRequesterA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody());
    expect(requesterDenied.status).toBe(403);
    expect(requesterDenied.body.error.code).toBe("ROLE_FORBIDDEN");
    await expect(prisma.actionTaken.count({ where: { ticketId: ticket.id } })).resolves.toBe(0);

    const missingCsrf = await request(app())
      .post(`/api/staff/tickets/${ticket.id}/actions`)
      .set("Cookie", authStaffA.cookie)
      .set("Origin", testClientOrigin)
      .send(createBody());
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_INVALID");
  });

  it("creates PENDING Actions with backend performer identity and an immutable CREATED event", async () => {
    const ticket = await createTicket(requesterA.id, "create");
    const response = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({
      description: "  Validate the incident and record diagnostic evidence.  ",
      attachmentNotes: "  See the Ticket attachment for the diagnostic output.  ",
    }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      replayed: false,
      action: {
        ticketId: ticket.id,
        workflowCycle: 1,
        description: "Validate the incident and record diagnostic evidence.",
        performedBy: { id: staffA.id },
        assignee: { id: staffA.id },
        status: "PENDING",
        version: 1,
      },
    });
    const event = await prisma.actionTakenEvent.findFirst({ where: { actionId: response.body.action.id } });
    expect(event).toMatchObject({ actorId: staffA.id, eventType: "CREATED", resultingVersion: 1, fromStatus: null, toStatus: "PENDING" });

    const forged = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...createBody(), performedById: staffB.id });
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe("VALIDATION_FAILED");

    const adminCreated = await writeAuth(authAdmin).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({
      description: "Administrator records an independent operational Action.",
      assigneeId: admin.id,
    }));
    expect(adminCreated.status).toBe(201);
    expect(adminCreated.body.action).toMatchObject({ performedBy: { id: admin.id }, assignee: { id: admin.id }, status: "PENDING" });
  });

  it("enforces follow-up and assignee validation", async () => {
    const ticket = await createTicket(requesterA.id, "validation");
    const missingFollowUp = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({
      followUpRequired: true,
      followUpNote: null,
    }));
    expect(missingFollowUp.status).toBe(400);
    expect(missingFollowUp.body.error.fieldErrors.followUpNote).toBeDefined();

    for (const assigneeId of [requesterA.id, inactiveStaff.id, 2_000_000_000]) {
      const response = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({ assigneeId }));
      expect(response.status, String(assigneeId)).toBe(409);
      expect(response.body.error.code, String(assigneeId)).toBe("ASSIGNEE_INELIGIBLE");
    }
  });

  it("provides safe idempotent replay/conflict behavior including concurrent identical create", async () => {
    const ticket = await createTicket(requesterA.id, "idempotency");
    const body = createBody();
    const first = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(body);
    const replay = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(body);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ replayed: true, action: { id: first.body.action.id } });

    const conflict = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send({ ...body, description: "Different normalized payload for same request identifier." });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const countBeforeInaccessibleReplay = await prisma.actionTaken.count({ where: { ticketId: ticket.id } });
    const inaccessibleIdentical = await writeAuth(authRequesterB).post(`/api/staff/tickets/${ticket.id}/actions`).send(body);
    const inaccessibleDifferent = await writeAuth(authRequesterB).post(`/api/staff/tickets/${ticket.id}/actions`).send({
      ...body,
      description: "A different payload must not reveal that this idempotency key already exists.",
    });
    for (const response of [inaccessibleIdentical, inaccessibleDifferent]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
      expect(response.body).not.toHaveProperty("action");
      expect(response.body).not.toHaveProperty("replayed");
      expect(JSON.stringify(response.body)).not.toContain("IDEMPOTENCY_CONFLICT");
    }
    await expect(prisma.actionTaken.count({ where: { ticketId: ticket.id } })).resolves.toBe(countBeforeInaccessibleReplay);

    const concurrentTicket = await createTicket(requesterA.id, "concurrent-idempotency");
    const concurrentBody = createBody();
    const results = await Promise.all([
      writeAuth(authStaffA).post(`/api/staff/tickets/${concurrentTicket.id}/actions`).send(concurrentBody),
      writeAuth(authStaffA).post(`/api/staff/tickets/${concurrentTicket.id}/actions`).send(concurrentBody),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 201]);
    expect(results[0].body.action.id).toBe(results[1].body.action.id);
    await expect(prisma.actionTaken.count({ where: { ticketId: concurrentTicket.id } })).resolves.toBe(1);
  });

  it("updates with optimistic concurrency, lifecycle rules and the real mutation actor", async () => {
    const ticket = await createTicket(requesterA.id, "update");
    const created = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody());
    const actionId = created.body.action.id as number;

    const started = await writeAuth(authStaffB).patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
      expectedVersion: 1,
      status: "IN_PROGRESS",
      assigneeId: staffB.id,
      attachmentNotes: "Updated by the second Staff member.",
    });
    expect(started.status).toBe(200);
    expect(started.body.action).toMatchObject({ status: "IN_PROGRESS", version: 2, assignee: { id: staffB.id } });

    const stale = await writeAuth(authStaffA).patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
      expectedVersion: 1,
      description: "This stale change must not overwrite the newer Action.",
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("VERSION_CONFLICT");

    const backwards = await writeAuth(authStaffB).patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
      expectedVersion: 2,
      status: "PENDING",
    });
    expect(backwards.status).toBe(409);
    expect(backwards.body.error.code).toBe("ACTION_TRANSITION_INVALID");

    const invalidCompletion = await writeAuth(authStaffB).patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
      expectedVersion: 2,
      status: "COMPLETED",
    });
    expect(invalidCompletion.status).toBe(400);
    expect(invalidCompletion.body.error.code).toBe("VALIDATION_FAILED");

    const completed = await writeAuth(authStaffB).patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
      expectedVersion: 2,
      result: "The service was restored and verified successfully.",
      status: "COMPLETED",
    });
    expect(completed.status).toBe(200);
    expect(completed.body.action).toMatchObject({ status: "COMPLETED", version: 3, performedBy: { id: staffA.id } });

    const events = await prisma.actionTakenEvent.findMany({ where: { actionId }, orderBy: { resultingVersion: "asc" } });
    expect(events.map(({ eventType, actorId, resultingVersion }) => ({ eventType, actorId, resultingVersion }))).toEqual([
      { eventType: "CREATED", actorId: staffA.id, resultingVersion: 1 },
      { eventType: "STATUS_CHANGED", actorId: staffB.id, resultingVersion: 2 },
      { eventType: "STATUS_CHANGED", actorId: staffB.id, resultingVersion: 3 },
    ]);

    const terminalEdit = await writeAuth(authAdmin).patch(`/api/staff/tickets/${ticket.id}/actions/${actionId}`).send({
      expectedVersion: 3,
      description: "Terminal Action should remain immutable.",
    });
    expect(terminalEdit.status).toBe(409);
    expect(terminalEdit.body.error.code).toBe("ACTION_TERMINAL");

    const cancellable = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions`).send(createBody({
      description: "A separate Action that will be cancelled with audit history.",
    }));
    const cancelled = await writeAuth(authAdmin).patch(`/api/staff/tickets/${ticket.id}/actions/${cancellable.body.action.id}`).send({
      expectedVersion: 1,
      status: "CANCELLED",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.action).toMatchObject({ status: "CANCELLED", version: 2 });
    await expect(prisma.actionTakenEvent.findFirst({
      where: { actionId: cancellable.body.action.id, resultingVersion: 2 },
    })).resolves.toMatchObject({ actorId: admin.id, eventType: "STATUS_CHANGED", fromStatus: "PENDING", toStatus: "CANCELLED" });
  });

  it("returns contracted validation and safe not-found responses", async () => {
    const ticket = await createTicket(requesterA.id, "safe-errors");
    const invalid = await writeAuth(authStaffA).post(`/api/staff/tickets/${ticket.id}/actions?force=true`).send(createBody());
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");

    const missingTicket = await writeAuth(authStaffA).post("/api/staff/tickets/2000000000/actions").send(createBody());
    expect(missingTicket.status).toBe(404);
    expect(missingTicket.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const missingAction = await writeAuth(authStaffA).patch(`/api/staff/tickets/${ticket.id}/actions/2000000000`).send({
      expectedVersion: 1,
      description: "Valid length but missing Action target.",
    });
    expect(missingAction.status).toBe(404);
    expect(missingAction.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });
});
