import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const validBody = {
  clientRequestId: "f13f2298-1153-4cea-966d-3bc466d53d7b",
  categoryId: 2,
  relatedSystemId: 7,
  summary: "  Laptop battery drains quickly  ",
  requestedPriority: "MEDIUM",
  description: "  Battery drops from full to empty in about one hour.  ",
};

function makeTicket() {
  const createdAt = new Date("2026-08-24T10:00:00.000Z");
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 7,
    summary: "Laptop battery drains quickly",
    description: "Battery drops from full to empty in about one hour.",
    requestedPriority: "MEDIUM" as const,
    currentStatus: "NEW",
    clientRequestId: validBody.clientRequestId,
    requestPayloadHash: "hash",
    createdAt,
    updatedAt: createdAt,
    requester: { id: 1, name: "Anan Srisuk", email: "anan.srisuk@example.test" },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 7, name: "Corporate Laptop" },
  };
}

function makePrisma(options: { existing?: ReturnType<typeof makeTicket>; failTransaction?: boolean } = {}) {
  const createdTicket = makeTicket();
  const ticket = options.existing;
  const transaction = {
    requesterUser: {
      findFirst: vi.fn().mockResolvedValue({ id: 1, name: "Anan Srisuk", email: "anan.srisuk@example.test" }),
    },
    category: {
      findFirst: vi.fn().mockResolvedValue({ id: 2, name: "Hardware" }),
    },
    relatedSystem: {
      findFirst: vi.fn().mockResolvedValue({ id: 7, name: "Corporate Laptop" }),
    },
    ticket: {
      findUnique: vi.fn().mockResolvedValue(ticket),
      create: vi.fn().mockResolvedValue(createdTicket),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: 42n }]),
  };
  const prisma = {
    ...transaction,
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => {
      if (options.failTransaction) throw new Error("database unavailable");
      return callback(transaction);
    }),
  } as unknown as ReferenceDataPrisma;

  return { prisma, transaction, createdTicket };
}

describe("POST /api/tickets", () => {
  it("creates a Ticket with normalized text, server number, and NEW status", async () => {
    const { prisma } = makePrisma();

    const res = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      replayed: false,
      ticket: {
        id: 42,
        ticketNumber: "TKT-2026-000042",
        ticketDate: "2026-08-24T10:00:00.000Z",
        summary: "Laptop battery drains quickly",
        description: "Battery drops from full to empty in about one hour.",
        requestedPriority: "MEDIUM",
        currentStatus: "NEW",
      },
    });
  });

  it("rejects missing requester context and invalid body fields", async () => {
    const { prisma } = makePrisma();

    const missingContext = await request(createApp(prisma)).post("/api/tickets").send(validBody);
    expect(missingContext.status).toBe(400);
    expect(missingContext.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");

    const invalidBody = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({ ...validBody, requesterId: 1, summary: "x", unknown: true });
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.body.error.code).toBe("VALIDATION_FAILED");
    expect(invalidBody.body.error.fieldErrors).toMatchObject({
      requesterId: ["This field is not supported."],
      unknown: ["This field is not supported."],
      summary: ["Summary must contain 5 to 120 characters."],
    });
  });

  it("rejects inactive or missing reference data", async () => {
    const { prisma, transaction } = makePrisma();
    transaction.category.findFirst.mockResolvedValue(null);

    const res = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { categoryId: ["Category does not exist or is inactive."] },
    });
  });

  it("rejects an inactive requester context", async () => {
    const { prisma, transaction } = makePrisma();
    transaction.requesterUser.findFirst.mockResolvedValue(null);

    const res = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("returns the existing Ticket on an idempotent replay", async () => {
    const existing = makeTicket();
    const { prisma, transaction } = makePrisma({ existing });
    transaction.ticket.findUnique.mockResolvedValue({ ...existing, requestPayloadHash: hashFor(validBody) });

    const res = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
    expect(res.body.ticket.ticketNumber).toBe(existing.ticketNumber);
    expect(transaction.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of a request ID with a different payload", async () => {
    const existing = makeTicket();
    const { prisma, transaction } = makePrisma({ existing });
    transaction.ticket.findUnique.mockResolvedValue({ ...existing, requestPayloadHash: "different-hash" });

    const res = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(transaction.ticket.create).not.toHaveBeenCalled();
  });

  it("returns a safe 500 response when ticket creation fails", async () => {
    const { prisma } = makePrisma({ failTransaction: true });

    const res = await request(createApp(prisma))
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: "TICKET_CREATE_FAILED",
      message: "Unable to create the Ticket.",
    });
    expect(res.body.error.correlationId).toEqual(expect.any(String));
  });
});

function hashFor(body: typeof validBody) {
  const normalized = JSON.stringify({
    categoryId: body.categoryId,
    relatedSystemId: body.relatedSystemId,
    summary: body.summary.trim(),
    requestedPriority: body.requestedPriority,
    description: body.description.trim(),
  });
  return createHash("sha256").update(normalized).digest("hex");
}
