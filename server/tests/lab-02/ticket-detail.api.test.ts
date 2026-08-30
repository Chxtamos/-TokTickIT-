import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const createdAt = new Date("2026-08-24T10:00:00.000Z");
const updatedAt = new Date("2026-08-25T10:00:00.000Z");

function makeTicket() {
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId: 1,
    summary: "Laptop battery drains quickly",
    description: "Battery drops from full to empty in about one hour.",
    requestedPriority: "MEDIUM" as const,
    currentStatus: "NEW",
    createdAt,
    updatedAt,
    requestPayloadHash: "private-hash",
    requester: { id: 1, name: "Anan Srisuk", email: "anan.srisuk@example.test" },
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 7, name: "Corporate Laptop" },
    attachments: [
      {
        id: 10,
        originalName: "battery-report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 205120,
        uploadedAt: new Date("2026-08-24T10:02:00.000Z"),
        removedAt: null,
        removedReason: null,
        storageKey: "private-storage-key",
      },
      {
        id: 11,
        originalName: "old-log.txt",
        mimeType: "text/plain",
        sizeBytes: 1200,
        uploadedAt: new Date("2026-08-24T10:03:00.000Z"),
        removedAt: new Date("2026-08-25T09:00:00.000Z"),
        removedReason: "Duplicate file",
        storageKey: "private-storage-key-2",
      },
    ],
  };
}

function makePrisma(options: { ticket?: unknown; fail?: boolean } = {}) {
  const ticketResult = Object.prototype.hasOwnProperty.call(options, "ticket") ? options.ticket : makeTicket();
  const prisma = {
    requesterUser: {
      findFirst: options.fail ? vi.fn().mockRejectedValue(new Error("database unavailable")) : vi.fn().mockResolvedValue({ id: 1 }),
    },
    ticket: {
      findFirst: options.fail ? vi.fn().mockRejectedValue(new Error("database unavailable")) : vi.fn().mockResolvedValue(ticketResult),
    },
  } as unknown as ReferenceDataPrisma;
  return prisma;
}

describe("GET /api/tickets/:ticketId", () => {
  it("returns owned Ticket detail with safe active and removed Attachment metadata", async () => {
    const prisma = makePrisma();
    const res = await request(createApp(prisma)).get("/api/tickets/42").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 42,
      ticketNumber: "TKT-2026-000042",
      ticketDate: "2026-08-24T10:00:00.000Z",
      requester: { id: 1, name: "Anan Srisuk", email: "anan.srisuk@example.test" },
      category: { id: 2, name: "Hardware" },
      relatedSystem: { id: 7, name: "Corporate Laptop" },
      summary: "Laptop battery drains quickly",
      requestedPriority: "MEDIUM",
      description: "Battery drops from full to empty in about one hour.",
      currentStatus: "NEW",
      createdAt: "2026-08-24T10:00:00.000Z",
      updatedAt: "2026-08-25T10:00:00.000Z",
      attachments: [
        {
          id: 10,
          originalName: "battery-report.pdf",
          mimeType: "application/pdf",
          sizeBytes: 205120,
          state: "ACTIVE",
          uploadedAt: "2026-08-24T10:02:00.000Z",
          removedAt: null,
          removedReason: null,
          downloadUrl: "/api/tickets/42/attachments/10/download",
        },
        {
          id: 11,
          originalName: "old-log.txt",
          mimeType: "text/plain",
          sizeBytes: 1200,
          state: "REMOVED",
          uploadedAt: "2026-08-24T10:03:00.000Z",
          removedAt: "2026-08-25T09:00:00.000Z",
          removedReason: "Duplicate file",
          downloadUrl: null,
        },
      ],
    });
    expect(res.body.requestPayloadHash).toBeUndefined();
    expect(res.body.attachments[0].storageKey).toBeUndefined();
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42, requesterId: 1 },
      select: expect.objectContaining({
        attachments: { orderBy: [{ uploadedAt: "asc" }, { id: "asc" }], select: expect.any(Object) },
      }),
    }));
  });

  it("returns the same safe 404 for missing and non-owned Tickets", async () => {
    const missing = await request(createApp(makePrisma({ ticket: null }))).get("/api/tickets/42").set("X-Requester-Id", "1");
    const nonOwned = await request(createApp(makePrisma({ ticket: null }))).get("/api/tickets/42").set("X-Requester-Id", "2");

    expect(missing.status).toBe(404);
    expect(nonOwned.status).toBe(404);
    expect(missing.body).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Ticket not found." } });
    expect(nonOwned.body).toEqual(missing.body);
  });

  it("rejects missing or malformed Requester and Ticket context", async () => {
    const prisma = makePrisma();
    const missingRequester = await request(createApp(prisma)).get("/api/tickets/42");
    const malformedTicket = await request(createApp(prisma)).get("/api/tickets/0").set("X-Requester-Id", "1");
    const unsafeTicket = await request(createApp(prisma)).get("/api/tickets/9007199254740992").set("X-Requester-Id", "1");

    expect(missingRequester.status).toBe(400);
    expect(missingRequester.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(malformedTicket.status).toBe(400);
    expect(malformedTicket.body.error.code).toBe("INVALID_TICKET_ID");
    expect(unsafeTicket.status).toBe(400);
    expect(unsafeTicket.body.error.code).toBe("INVALID_TICKET_ID");
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("rejects unknown or inactive Requester before querying Ticket data", async () => {
    const unknownPrisma = makePrisma();
    vi.mocked(unknownPrisma.requesterUser.findFirst).mockResolvedValue(null);
    const unknown = await request(createApp(unknownPrisma)).get("/api/tickets/42").set("X-Requester-Id", "999");

    const inactivePrisma = makePrisma();
    vi.mocked(inactivePrisma.requesterUser.findFirst).mockResolvedValue(null);
    const inactive = await request(createApp(inactivePrisma)).get("/api/tickets/42").set("X-Requester-Id", "1");

    expect(unknown.status).toBe(400);
    expect(inactive.status).toBe(400);
    expect(unknown.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(inactive.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
    expect(unknownPrisma.ticket.findFirst).not.toHaveBeenCalled();
    expect(inactivePrisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("returns a safe error when detail lookup fails", async () => {
    const res = await request(createApp(makePrisma({ fail: true }))).get("/api/tickets/42").set("X-Requester-Id", "1");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "TICKET_DETAIL_FAILED", message: "Unable to load Ticket details." });
    expect(res.body.error.correlationId).toEqual(expect.any(String));
  });
});
