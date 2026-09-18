import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createTestSession } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("GET /api/tickets/:ticketId PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketId: number;
  let authA: Awaited<ReturnType<typeof createTestSession>>;
  let authB: Awaited<ReturnType<typeof createTestSession>>;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [requesters, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findMany({ where: { isActive: true, role: "REQUESTER" }, select: { id: true }, orderBy: { id: "asc" }, take: 2 }),
      prisma.category.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, select: { id: true } }),
    ]);
    if (requesters.length < 2 || !category || !relatedSystem) {
      throw new Error("Integration test requires two active Requesters and seeded reference data.");
    }
    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    [authA, authB] = await Promise.all([
      createTestSession(prisma, requesterA),
      createTestSession(prisma, requesterB),
    ]);

    const [{ nextval }] = await prisma.$queryRaw<Array<{ nextval: bigint }>>(
      Prisma.sql`SELECT nextval('"TicketNumberSequence"')`,
    );
    const created = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${new Date().getUTCFullYear()}-${nextval.toString().padStart(6, "0")}`,
        requesterId: requesterA,
        categoryId,
        relatedSystemId,
        summary: "Ticket detail integration fixture",
        description: "Fixture for owner isolation and Attachment ordering.",
        requestedPriority: "HIGH",
        currentStatus: "OPEN",
        clientRequestId: randomUUID(),
        requestPayloadHash: "a".repeat(64),
        attachments: {
          create: [
            {
              originalName: "first.txt",
              storageKey: randomUUID(),
              mimeType: "text/plain",
              sizeBytes: 10,
              uploadedAt: new Date("2026-08-24T10:00:00.000Z"),
            },
            {
              originalName: "removed.txt",
              storageKey: randomUUID(),
              mimeType: "text/plain",
              sizeBytes: 20,
              uploadedAt: new Date("2026-08-24T10:00:00.000Z"),
              removedAt: new Date("2026-08-25T10:00:00.000Z"),
              removedReason: "No longer needed",
              removedByRequesterId: requesterA,
            },
          ],
        },
      },
    });
    ticketId = created.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (ticketId) await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.$disconnect();
  });

  it("returns ordered details to the owner and safely rejects another owner", async () => {
    const app = createApp(prisma);
    const owned = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", authA.cookie);
    expect(owned.status).toBe(200);
    expect(owned.body.attachments.map((attachment: { originalName: string }) => attachment.originalName)).toEqual(["first.txt", "removed.txt"]);
    expect(owned.body.attachments[0]).toMatchObject({ state: "ACTIVE", downloadUrl: `/api/tickets/${ticketId}/attachments/${owned.body.attachments[0].id}/download` });
    expect(owned.body.attachments[1]).toMatchObject({ state: "REMOVED", downloadUrl: null, removedReason: "No longer needed" });
    expect(owned.body.attachments[0].storageKey).toBeUndefined();
    expect(owned.body.requestPayloadHash).toBeUndefined();

    const nonOwner = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", authB.cookie);
    expect(nonOwner.status).toBe(404);
    expect(nonOwner.body).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Ticket not found." } });
  });

  it("records the owner resolution indication with optimistic versioning", async () => {
    const app = createApp(prisma);
    const indicated = await request(app)
      .post(`/api/tickets/${ticketId}/resolution-indication`)
      .set("Cookie", authA.cookie)
      .set("Origin", process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173")
      .set("X-CSRF-Token", authA.csrfToken)
      .send({ expectedVersion: 1 });
    expect(indicated.status).toBe(200);
    expect(indicated.body).toMatchObject({ currentStatus: "OPEN", version: 2, requesterResolvedBy: { id: requesterA } });
    await expect(prisma.ticket.findUnique({ where: { id: ticketId } })).resolves.toMatchObject({
      currentStatus: "OPEN",
      version: 2,
      requesterResolvedAt: expect.any(Date),
      requesterResolvedById: requesterA,
    });

    const repeated = await request(app)
      .post(`/api/tickets/${ticketId}/resolution-indication`)
      .set("Cookie", authA.cookie)
      .set("Origin", process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173")
      .set("X-CSRF-Token", authA.csrfToken)
      .send({ expectedVersion: 2 });
    expect(repeated.status).toBe(200);
    expect(repeated.body.version).toBe(2);

    const nonOwner = await request(app)
      .post(`/api/tickets/${ticketId}/resolution-indication`)
      .set("Cookie", authB.cookie)
      .set("Origin", process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173")
      .set("X-CSRF-Token", authB.csrfToken)
      .send({ expectedVersion: 2 });
    expect(nonOwner.status).toBe(404);
  });
});
