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

integration("Lab 4 authorization and safe-failure hardening", () => {
  let prisma: PrismaClient;
  let requesterA: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let requesterB: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let staff: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let admin: Awaited<ReturnType<typeof createProvisionedTestUser>>;
  let requesterAAuth: Awaited<ReturnType<typeof createTestSession>>;
  let requesterBAuth: Awaited<ReturnType<typeof createTestSession>>;
  let staffAuth: Awaited<ReturnType<typeof createTestSession>>;
  let adminAuth: Awaited<ReturnType<typeof createTestSession>>;
  let ticketId: number;
  const userIds: number[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
      prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } }),
    ]);
    [requesterA, requesterB, staff, admin] = await Promise.all([
      createProvisionedTestUser(prisma, "REQUESTER", "Hardening Requester A"),
      createProvisionedTestUser(prisma, "REQUESTER", "Hardening Requester B"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Hardening Staff"),
      createProvisionedTestUser(prisma, "ADMINISTRATOR", "Hardening Admin"),
    ]);
    userIds.push(requesterA.id, requesterB.id, staff.id, admin.id);
    [requesterAAuth, requesterBAuth, staffAuth, adminAuth] = await Promise.all([
      createTestSession(prisma, requesterA.id),
      createTestSession(prisma, requesterB.id),
      createTestSession(prisma, staff.id),
      createTestSession(prisma, admin.id),
    ]);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-L4-HARD-${randomUUID().slice(0, 8)}`,
        requesterId: requesterA.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: "Hardening ownership fixture",
        description: "Authorization hardening fixture for cross-role and ownership checks.",
        requestedPriority: "MEDIUM",
        itPriority: "MEDIUM",
        currentStatus: "IN_PROGRESS",
        clientRequestId: randomUUID(),
        requestPayloadHash: "e".repeat(64),
      },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (ticketId) await prisma.ticket.deleteMany({ where: { id: ticketId } });
    if (userIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("keeps dashboard routes role-first and does not expose cross-role data", async () => {
    const app = createApp(prisma);
    const requesterOnStaff = await request(app).get("/api/staff/dashboard").set("Cookie", requesterAAuth.cookie);
    const staffOnRequester = await request(app).get("/api/requester/dashboard").set("Cookie", staffAuth.cookie);
    const adminOnRequester = await request(app).get("/api/requester/dashboard").set("Cookie", adminAuth.cookie);
    for (const response of [requesterOnStaff, staffOnRequester, adminOnRequester]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
      expect(JSON.stringify(response.body)).not.toContain("ticketNumber");
    }
  });

  it("preserves Requester non-enumeration for another Requester's Ticket and Actions", async () => {
    const app = createApp(prisma);
    const detail = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", requesterBAuth.cookie);
    const actions = await request(app).get(`/api/tickets/${ticketId}/actions`).set("Cookie", requesterBAuth.cookie);
    for (const response of [detail, actions]) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("RESOURCE_NOT_FOUND");
      expect(JSON.stringify(response.body)).not.toContain("Hardening ownership fixture");
    }
  });

  it("rejects direct Requester Action writes and invalid CSRF without mutating data", async () => {
    const app = createApp(prisma);
    const body = {
      clientRequestId: randomUUID(),
      description: "Requester must not be able to create this Action.",
      result: null,
      assigneeId: staff.id,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    };
    const before = await prisma.actionTaken.count({ where: { ticketId } });
    const requesterDenied = await request(app)
      .post(`/api/staff/tickets/${ticketId}/actions`)
      .set("Cookie", requesterAAuth.cookie)
      .set("Origin", testClientOrigin)
      .set("X-CSRF-Token", requesterAAuth.csrfToken)
      .send(body);
    expect(requesterDenied.status).toBe(403);
    expect(requesterDenied.body.error.code).toBe("ROLE_FORBIDDEN");

    const csrfDenied = await request(app)
      .post(`/api/staff/tickets/${ticketId}/actions`)
      .set("Cookie", staffAuth.cookie)
      .set("Origin", testClientOrigin)
      .send(body);
    expect(csrfDenied.status).toBe(403);
    expect(csrfDenied.body.error.code).toBe("CSRF_INVALID");
    await expect(prisma.actionTaken.count({ where: { ticketId } })).resolves.toBe(before);
  });
});
