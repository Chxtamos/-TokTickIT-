import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const integration = runIntegration ? describe : describe.skip;

integration("GET /api/tickets/:ticketId PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketId: number;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    const [requesters, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findMany({ where: { isActive: true }, select: { id: true }, orderBy: { id: "asc" }, take: 2 }),
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
        currentStatus: "NEW",
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
    const owned = await request(app).get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(requesterA));
    expect(owned.status).toBe(200);
    expect(owned.body.attachments.map((attachment: { originalName: string }) => attachment.originalName)).toEqual(["first.txt", "removed.txt"]);
    expect(owned.body.attachments[0]).toMatchObject({ state: "ACTIVE", downloadUrl: `/api/tickets/${ticketId}/attachments/${owned.body.attachments[0].id}/download` });
    expect(owned.body.attachments[1]).toMatchObject({ state: "REMOVED", downloadUrl: null, removedReason: "No longer needed" });
    expect(owned.body.attachments[0].storageKey).toBeUndefined();
    expect(owned.body.requestPayloadHash).toBeUndefined();

    const nonOwner = await request(app).get(`/api/tickets/${ticketId}`).set("X-Requester-Id", String(requesterB));
    expect(nonOwner.status).toBe(404);
    expect(nonOwner.body).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Ticket not found." } });
  });
});
