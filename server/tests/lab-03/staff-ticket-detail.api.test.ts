import { createHash } from "node:crypto";
import type { UserRole } from "@prisma/client";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const token = "staff-detail-session-token";
const tokenHash = createHash("sha256").update(token).digest("hex");
const cookie = `toktickit.sid=${token}`;

function ticketFixture() {
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 7,
    ticketOwnerId: 10,
    summary: "VPN disconnects during meetings",
    description: "The submitted description remains immutable for operational users.",
    requestedPriority: "HIGH" as const,
    itPriority: "URGENT" as const,
    currentStatus: "IN_PROGRESS" as const,
    version: 7,
    resolutionSummary: "Temporary workaround applied while root cause is investigated.",
    resolvedAt: new Date("2026-09-18T08:30:00.000Z"),
    closedAt: null,
    requesterResolvedAt: new Date("2026-09-18T09:00:00.000Z"),
    requesterResolvedById: 1,
    lastStatusReason: "Requester reported recurrence after the workaround.",
    clientRequestId: "f13f2298-1153-4cea-966d-3bc466d53d7b",
    requestPayloadHash: "private-payload-hash",
    createdAt: new Date("2026-09-17T05:00:00.000Z"),
    updatedAt: new Date("2026-09-18T09:00:00.000Z"),
    requester: { id: 1, name: "Requester One", email: "requester.one@example.test", role: "REQUESTER" as const },
    owner: { id: 10, name: "IT Staff One", email: "staff.one@example.test", role: "IT_STAFF" as const },
    requesterResolved: { id: 1, name: "Requester One", email: "requester.one@example.test", role: "REQUESTER" as const },
    category: { id: 2, name: "Network" },
    relatedSystem: { id: 7, name: "VPN" },
    attachments: [
      {
        id: 12,
        originalName: "vpn-log.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        uploadedAt: new Date("2026-09-17T05:05:00.000Z"),
        removedAt: null,
        removedReason: null,
        storageKey: "private-storage-key",
      },
      {
        id: 13,
        originalName: "old-screenshot.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        uploadedAt: new Date("2026-09-17T05:06:00.000Z"),
        removedAt: new Date("2026-09-18T06:00:00.000Z"),
        removedReason: "Superseded by a clearer capture",
        storageKey: "private-removed-storage-key",
      },
    ],
    publicComments: [{ id: 99, content: "must not be embedded in detail" }],
    internalNotes: [{ id: 100, content: "private note must never be projected" }],
  };
}

function makePrisma(role: UserRole, options: { ticket?: ReturnType<typeof ticketFixture> | null; fail?: boolean } = {}) {
  const user = {
    id: role === "IT_STAFF" ? 10 : role === "ADMINISTRATOR" ? 20 : 1,
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.test`,
    role,
    isActive: true,
    passwordHash: "unused",
    mustChangePassword: false,
    passwordChangedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
  const findFirst = options.fail
    ? vi.fn().mockRejectedValue(new Error("database unavailable"))
    : vi.fn().mockResolvedValue(Object.prototype.hasOwnProperty.call(options, "ticket") ? options.ticket : ticketFixture());
  const prisma = {
    ticket: { findFirst },
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === tokenHash ? {
        id: "00000000-0000-4000-8000-000000000062",
        tokenHash,
        userId: user.id,
        csrfToken: "a".repeat(64),
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user,
      } : null),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as ReferenceDataPrisma;
  return { prisma, findFirst };
}

describe("GET /api/staff/tickets/:ticketId", () => {
  it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("returns the exact safe operational TicketDetail for %s", async (role) => {
    const fixture = makePrisma(role);
    const response = await request(createApp(fixture.prisma)).get("/api/staff/tickets/42").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({
      id: 42,
      ticketNumber: "TKT-2026-000042",
      ticketDate: "2026-09-17T05:00:00.000Z",
      requester: { id: 1, name: "Requester One", email: "requester.one@example.test", role: "REQUESTER" },
      category: { id: 2, name: "Network" },
      relatedSystem: { id: 7, name: "VPN" },
      summary: "VPN disconnects during meetings",
      requestedPriority: "HIGH",
      itPriority: "URGENT",
      description: "The submitted description remains immutable for operational users.",
      currentStatus: "IN_PROGRESS",
      version: 7,
      ticketOwner: { id: 10, name: "IT Staff One", email: "staff.one@example.test", role: "IT_STAFF" },
      resolutionSummary: "Temporary workaround applied while root cause is investigated.",
      resolvedAt: "2026-09-18T08:30:00.000Z",
      closedAt: null,
      lastStatusReason: "Requester reported recurrence after the workaround.",
      requesterResolvedAt: "2026-09-18T09:00:00.000Z",
      requesterResolvedBy: { id: 1, name: "Requester One", email: "requester.one@example.test", role: "REQUESTER" },
      createdAt: "2026-09-17T05:00:00.000Z",
      updatedAt: "2026-09-18T09:00:00.000Z",
      attachments: [
        {
          id: 12,
          originalName: "vpn-log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          state: "ACTIVE",
          uploadedAt: "2026-09-17T05:05:00.000Z",
          removedAt: null,
          removedReason: null,
          downloadUrl: "/api/tickets/42/attachments/12/download",
        },
        {
          id: 13,
          originalName: "old-screenshot.png",
          mimeType: "image/png",
          sizeBytes: 1024,
          state: "REMOVED",
          uploadedAt: "2026-09-17T05:06:00.000Z",
          removedAt: "2026-09-18T06:00:00.000Z",
          removedReason: "Superseded by a clearer capture",
          downloadUrl: null,
        },
      ],
    });
    expect(response.body.requestPayloadHash).toBeUndefined();
    expect(response.body.clientRequestId).toBeUndefined();
    expect(response.body.publicComments).toBeUndefined();
    expect(response.body.internalNotes).toBeUndefined();
    expect(response.body.attachments[0].storageKey).toBeUndefined();
    expect(fixture.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42 },
      select: expect.objectContaining({
        requester: expect.any(Object),
        owner: expect.any(Object),
        requesterResolved: expect.any(Object),
        attachments: { orderBy: [{ uploadedAt: "asc" }, { id: "asc" }], select: expect.any(Object) },
      }),
    }));
  });

  it("returns safe 404 for a missing Ticket and does not scope operational detail to ownership", async () => {
    const fixture = makePrisma("IT_STAFF", { ticket: null });
    const response = await request(createApp(fixture.prisma)).get("/api/staff/tickets/999").set("Cookie", cookie);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Ticket not found." } });
    expect(fixture.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 999 } }));
  });

  it("rejects Requester access before protected Ticket lookup", async () => {
    const fixture = makePrisma("REQUESTER");
    const response = await request(createApp(fixture.prisma)).get("/api/staff/tickets/42").set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(fixture.findFirst).not.toHaveBeenCalled();
  });

  it("rejects malformed and unsafe Ticket IDs before lookup", async () => {
    const fixture = makePrisma("IT_STAFF");
    for (const id of ["0", "-1", "abc", "2147483648", "9007199254740992"]) {
      const response = await request(createApp(fixture.prisma)).get(`/api/staff/tickets/${id}`).set("Cookie", cookie);
      expect(response.status, id).toBe(400);
      expect(response.body.error.code, id).toBe("INVALID_TICKET_ID");
    }
    expect(fixture.findFirst).not.toHaveBeenCalled();
  });

  it("rejects unsupported query parameters before Ticket lookup", async () => {
    const fixture = makePrisma("IT_STAFF");
    const response = await request(createApp(fixture.prisma))
      .get("/api/staff/tickets/42?include=internalNotes")
      .set("Cookie", cookie);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "This endpoint does not accept query parameters.",
        fieldErrors: { include: ["This query parameter is not supported."] },
      },
    });
    expect(fixture.findFirst).not.toHaveBeenCalled();
  });

  it("returns a safe correlated failure without leaking database details", async () => {
    const fixture = makePrisma("ADMINISTRATOR", { fail: true });
    const response = await request(createApp(fixture.prisma)).get("/api/staff/tickets/42").set("Cookie", cookie);

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({ code: "TICKET_DETAIL_FAILED", message: "Unable to load Ticket details." });
    expect(response.body.error.correlationId).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("database unavailable");
  });
});
