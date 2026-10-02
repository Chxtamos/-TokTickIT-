import { randomUUID } from "node:crypto";
import type { PrismaClient, TicketStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession, testClientOrigin } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Issue #61 conversations PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let categoryId: number;
  let relatedSystemId: number;
  let requesterAId: number;
  let requesterBId: number;
  let staffId: number;
  let adminId: number;
  let requesterAAuth: Awaited<ReturnType<typeof createTestSession>>;
  let requesterBAuth: Awaited<ReturnType<typeof createTestSession>>;
  let staffAuth: Awaited<ReturnType<typeof createTestSession>>;
  let adminAuth: Awaited<ReturnType<typeof createTestSession>>;
  const userIds: number[] = [];
  const requestIds: string[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, relatedSystem] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
    ]);
    if (!category || !relatedSystem) throw new Error("Conversation integration requires active reference fixtures.");
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;

    const [requesterA, requesterB, staff, admin] = await Promise.all([
      createProvisionedTestUser(prisma, "REQUESTER", "Conversation Requester A"),
      createProvisionedTestUser(prisma, "REQUESTER", "Conversation Requester B"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Conversation Staff"),
      createProvisionedTestUser(prisma, "ADMINISTRATOR", "Conversation Admin"),
    ]);
    requesterAId = requesterA.id;
    requesterBId = requesterB.id;
    staffId = staff.id;
    adminId = admin.id;
    userIds.push(requesterAId, requesterBId, staffId, adminId);
    [requesterAAuth, requesterBAuth, staffAuth, adminAuth] = await Promise.all([
      createTestSession(prisma, requesterAId),
      createTestSession(prisma, requesterBId),
      createTestSession(prisma, staffId),
      createTestSession(prisma, adminId),
    ]);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (requestIds.length) await prisma.ticket.deleteMany({ where: { clientRequestId: { in: requestIds } } });
    if (userIds.length) await prisma.requesterUser.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function createTicket(status: TicketStatus = "IN_PROGRESS") {
    const clientRequestId = randomUUID();
    requestIds.push(clientRequestId);
    return prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2098-${randomUUID().slice(0, 8)}`,
        requesterId: requesterAId,
        categoryId,
        relatedSystemId,
        ticketOwnerId: staffId,
        summary: "Issue 61 PostgreSQL conversation fixture",
        description: "An isolated Ticket proving append-only public and private conversation behavior.",
        requestedPriority: "HIGH",
        itPriority: "URGENT",
        currentStatus: status,
        version: 7,
        resolutionSummary: "Existing resolution must remain unchanged.",
        resolvedAt: new Date("2026-09-18T01:00:00.000Z"),
        closedAt: status === "CLOSED" ? new Date("2026-09-18T02:00:00.000Z") : null,
        requesterResolvedAt: new Date("2026-09-18T03:00:00.000Z"),
        requesterResolvedById: requesterAId,
        lastStatusReason: "Existing status reason",
        clientRequestId,
        requestPayloadHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
  }

  function api(session: Awaited<ReturnType<typeof createTestSession>>) {
    const app = createApp(prisma);
    const authenticated = (call: request.Test) => call
      .set("Cookie", session.cookie)
      .set("Origin", testClientOrigin)
      .set("X-CSRF-Token", session.csrfToken);
    return {
      get: (path: string) => request(app).get(path).set("Cookie", session.cookie),
      post: (path: string) => authenticated(request(app).post(path)),
    };
  }

  it("appends ordered Public Comments with backend author/time and creates two rows without deduplication", async () => {
    const ticket = await createTicket();
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const first = await api(requesterAAuth).post(`/api/tickets/${ticket.id}/comments`).send({ content: "  requester comment  " });
    const second = await api(staffAuth).post(`/api/tickets/${ticket.id}/comments`).send({ content: "staff comment" });
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.entry).toMatchObject({ ticketId: ticket.id, content: "requester comment", author: { id: requesterAId, role: "REQUESTER" } });
    expect(second.body.entry).toMatchObject({ ticketId: ticket.id, content: "staff comment", author: { id: staffId, role: "IT_STAFF" } });
    expect(first.body.entry.id).not.toBe(second.body.entry.id);
    expect(new Date(first.body.entry.createdAt).toString()).not.toBe("Invalid Date");

    const listed = await api(adminAuth).get(`/api/tickets/${ticket.id}/comments`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((entry: { id: number }) => entry.id)).toEqual([first.body.entry.id, second.body.entry.id]);
    expect(JSON.stringify(listed.body)).not.toContain("email");
    await expect(prisma.publicComment.count({ where: { ticketId: ticket.id } })).resolves.toBe(2);

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(after).toMatchObject({
      version: before.version,
      currentStatus: before.currentStatus,
      ticketOwnerId: before.ticketOwnerId,
      requestedPriority: before.requestedPriority,
      itPriority: before.itPriority,
      resolutionSummary: before.resolutionSummary,
      requesterResolvedAt: before.requesterResolvedAt,
      requesterResolvedById: before.requesterResolvedById,
      lastStatusReason: before.lastStatusReason,
    });
  });

  it("keeps Requester A/B ownership isolation for Public Comments", async () => {
    const ticket = await createTicket();
    const deniedGet = await api(requesterBAuth).get(`/api/tickets/${ticket.id}/comments`);
    const deniedPost = await api(requesterBAuth).post(`/api/tickets/${ticket.id}/comments`).send({ content: "must not save" });
    expect(deniedGet.status).toBe(404);
    expect(deniedPost.status).toBe(404);
    expect(deniedGet.body.error.code).toBe("RESOURCE_NOT_FOUND");
    await expect(prisma.publicComment.count({ where: { ticketId: ticket.id } })).resolves.toBe(0);
  });

  it("keeps updatedAt monotonic when concurrent conversation writes have stale touch timestamps", async () => {
    const ticket = await createTicket();
    const futureUpdatedAt = new Date("2099-01-01T00:00:00.000Z");
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: futureUpdatedAt } });

    const [comment, note] = await Promise.all([
      api(requesterAAuth).post(`/api/tickets/${ticket.id}/comments`).send({ content: "concurrent public touch" }),
      api(staffAuth).post(`/api/tickets/${ticket.id}/internal-notes`).send({ content: "concurrent private touch" }),
    ]);

    expect([comment.status, note.status]).toEqual([201, 201]);
    await expect(prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).resolves.toMatchObject({
      updatedAt: futureUpdatedAt,
      version: ticket.version,
      currentStatus: ticket.currentStatus,
      ticketOwnerId: ticket.ticketOwnerId,
    });
    await expect(prisma.publicComment.count({ where: { ticketId: ticket.id } })).resolves.toBe(1);
    await expect(prisma.internalNote.count({ where: { ticketId: ticket.id } })).resolves.toBe(1);
  });

  it("appends ordered Staff/Admin Internal Notes on terminal Tickets and rejects Requesters directly", async () => {
    for (const status of ["CLOSED", "CANCELLED"] as const) {
      const ticket = await createTicket(status);
      const staff = await api(staffAuth).post(`/api/tickets/${ticket.id}/internal-notes`).send({ content: "staff private note" });
      const admin = await api(adminAuth).post(`/api/tickets/${ticket.id}/internal-notes`).send({ content: "admin private note" });
      expect([staff.status, admin.status]).toEqual([201, 201]);
      const listed = await api(staffAuth).get(`/api/tickets/${ticket.id}/internal-notes`);
      expect(listed.body.items).toEqual([staff.body.entry, admin.body.entry]);
      expect(listed.body.items.map((entry: { author: { id: number } }) => entry.author.id)).toEqual([staffId, adminId]);

      const requesterGet = await api(requesterAAuth).get(`/api/tickets/${ticket.id}/internal-notes`);
      const requesterPost = await api(requesterAAuth).post(`/api/tickets/${ticket.id}/internal-notes`).send({ content: "forbidden" });
      expect(requesterGet.status).toBe(403);
      expect(requesterPost.status).toBe(403);
      await expect(prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).resolves.toMatchObject({ currentStatus: status, version: 7 });
    }
  });

  it("keeps public and private models/projections separate with no count or content leakage", async () => {
    const ticket = await createTicket();
    await api(requesterAAuth).post(`/api/tickets/${ticket.id}/comments`).send({ content: "PUBLIC-MODEL-CONTENT" });
    await api(staffAuth).post(`/api/tickets/${ticket.id}/internal-notes`).send({ content: "PRIVATE-MODEL-CONTENT" });

    const [comments, detail, modelCounts] = await Promise.all([
      api(requesterAAuth).get(`/api/tickets/${ticket.id}/comments`),
      api(requesterAAuth).get(`/api/tickets/${ticket.id}`),
      Promise.all([
        prisma.publicComment.count({ where: { ticketId: ticket.id } }),
        prisma.internalNote.count({ where: { ticketId: ticket.id } }),
      ]),
    ]);
    expect(modelCounts).toEqual([1, 1]);
    expect(comments.body.items).toHaveLength(1);
    expect(comments.body.items[0].content).toBe("PUBLIC-MODEL-CONTENT");
    for (const response of [comments, detail]) {
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain("PRIVATE-MODEL-CONTENT");
      expect(serialized).not.toContain("internalNotes");
      expect(serialized).not.toContain("noteCount");
    }
  });
});
