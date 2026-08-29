import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const integration = runIntegration ? describe : describe.skip;

integration("POST /api/tickets PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;
  const requestIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const [requester, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.category.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, select: { id: true } }),
    ]);
    if (!requester || !category || !relatedSystem) {
      throw new Error("Integration test requires seeded active requester, category, and related system data.");
    }
    requesterId = requester.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (requestIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { clientRequestId: { in: requestIds } } });
    }
    await prisma.$disconnect();
  });

  it("persists create, replays idempotently, rejects conflicts, and increments Ticket Numbers", async () => {
    const app = createApp(prisma);
    const firstRequestId = randomUUID();
    const secondRequestId = randomUUID();
    requestIds.push(firstRequestId, secondRequestId);
    const firstBody = {
      clientRequestId: firstRequestId,
      categoryId,
      relatedSystemId,
      summary: "PostgreSQL integration ticket",
      requestedPriority: "URGENT",
      description: "Created against the real PostgreSQL database for Lab 2 verification.",
    };

    const first = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).send(firstBody);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ replayed: false, ticket: { currentStatus: "NEW", requestedPriority: "URGENT" } });

    const stored = await prisma.ticket.findUnique({
      where: { requesterId_clientRequestId: { requesterId, clientRequestId: firstRequestId } },
    });
    expect(stored).toMatchObject({
      requesterId,
      categoryId,
      relatedSystemId,
      summary: firstBody.summary,
      description: firstBody.description,
      currentStatus: "NEW",
      requestedPriority: "URGENT",
    });

    const replay = await request(app).post("/api/tickets").set("X-Requester-Id", String(requesterId)).send(firstBody);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ replayed: true, ticket: { ticketNumber: first.body.ticket.ticketNumber } });

    const conflict = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .send({ ...firstBody, summary: "A different ticket payload" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const second = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", String(requesterId))
      .send({ ...firstBody, clientRequestId: secondRequestId, summary: "Second PostgreSQL ticket" });
    expect(second.status).toBe(201);

    const firstNumber = /^TKT-\d{4}-(\d{6})$/.exec(first.body.ticket.ticketNumber);
    const secondNumber = /^TKT-\d{4}-(\d{6})$/.exec(second.body.ticket.ticketNumber);
    expect(firstNumber).not.toBeNull();
    expect(secondNumber).not.toBeNull();
    expect(Number(secondNumber![1])).toBeGreaterThan(Number(firstNumber![1]));
    await expect(prisma.ticket.count({ where: { requesterId, clientRequestId: { in: requestIds } } })).resolves.toBe(2);
  });
});
