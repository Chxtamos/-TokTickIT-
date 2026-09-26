import { createHash } from "node:crypto";
import type { RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { allowedStatusTransitions, ticketStatuses } from "../../src/ticket-workflow.js";

const token = "staff-detail-session-token";
const tokenHash = createHash("sha256").update(token).digest("hex");
const cookie = `toktickit.sid=${token}`;
const origin = "http://127.0.0.1:5173";
const csrfToken = "a".repeat(64);

beforeEach(() => {
  process.env.CLIENT_ORIGIN = origin;
});

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

type MutationOptions = {
  role?: UserRole;
  status?: TicketStatus;
  version?: number;
  ownerId?: number | null;
  itPriority?: RequestedPriority;
  inactiveUserIds?: number[];
  failTransaction?: boolean;
};

function makeMutationPrisma(options: MutationOptions = {}) {
  const role = options.role ?? "IT_STAFF";
  const actorId = role === "IT_STAFF" ? 10 : role === "ADMINISTRATOR" ? 20 : 1;
  const users = [
    { id: 1, name: "Requester One", email: "requester.one@example.test", role: "REQUESTER" as const, isActive: true },
    { id: 10, name: "IT Staff One", email: "staff.one@example.test", role: "IT_STAFF" as const, isActive: true },
    { id: 20, name: "Admin One", email: "admin.one@example.test", role: "ADMINISTRATOR" as const, isActive: true },
    { id: 30, name: "Inactive Staff", email: "inactive@example.test", role: "IT_STAFF" as const, isActive: false },
  ].map((user) => ({ ...user, isActive: options.inactiveUserIds?.includes(user.id) ? false : user.isActive }));
  const authUser = {
    ...users.find(({ id }) => id === actorId)!,
    passwordHash: "unused",
    mustChangePassword: false,
    passwordChangedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
  const ticket: any = ticketFixture();
  ticket.currentStatus = options.status ?? "IN_PROGRESS";
  ticket.version = options.version ?? 7;
  ticket.itPriority = options.itPriority ?? "URGENT";
  ticket.ticketOwnerId = Object.prototype.hasOwnProperty.call(options, "ownerId") ? options.ownerId : 10;
  const owner = users.find(({ id }) => id === ticket.ticketOwnerId);
  ticket.owner = owner ? { id: owner.id, name: owner.name, email: owner.email, role: owner.role } : null;

  const ownerChanges: any[] = [];
  const updateMany = vi.fn(async ({ where, data }: any) => {
    if (where.version !== ticket.version) return { count: 0 };
    for (const [key, value] of Object.entries(data)) {
      if (key === "version") ticket.version += (value as { increment: number }).increment;
      else ticket[key] = value;
    }
    if (Object.prototype.hasOwnProperty.call(data, "ticketOwnerId")) {
      const savedOwner = users.find(({ id }) => id === data.ticketOwnerId);
      ticket.owner = savedOwner ? { id: savedOwner.id, name: savedOwner.name, email: savedOwner.email, role: savedOwner.role } : null;
    }
    if (data.requesterResolvedById === null) ticket.requesterResolved = null;
    return { count: 1 };
  });
  const transaction: any = {
    requesterUser: {
      findFirst: vi.fn(async ({ where }: any) => {
        const user = users.find(({ id }) => id === where.id);
        if (!user || (where.isActive === true && !user.isActive)) return null;
        if (where.role?.in && !where.role.in.includes(user.role)) return null;
        return { id: user.id };
      }),
    },
    ticket: {
      findFirst: vi.fn(async () => ({ ...ticket })),
      updateMany,
    },
    ticketOwnerChange: {
      create: vi.fn(async ({ data }: any) => {
        ownerChanges.push({ id: ownerChanges.length + 1, ...data });
        return ownerChanges.at(-1);
      }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: ticket.id }]),
  };
  const prisma = {
    ...transaction,
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === tokenHash ? {
        id: "00000000-0000-4000-8000-000000000060",
        tokenHash,
        userId: authUser.id,
        csrfToken,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user: authUser,
      } : null),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => {
      if (options.failTransaction) throw new Error("private database failure");
      return callback(transaction);
    }),
  } as unknown as ReferenceDataPrisma;
  return { prisma, transaction, ticket, ownerChanges, updateMany };
}

function staffWrite(application: ReturnType<typeof createApp>) {
  return {
    post: (path: string) => request(application).post(path).set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken),
    patch: (path: string) => request(application).patch(path).set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken),
  };
}

function statusBody(target: string, expectedVersion = 7) {
  if (target === "RESOLVED") return { currentStatus: target, expectedVersion, resolutionSummary: "A complete verified resolution." };
  if (target === "REOPENED" || target === "CANCELLED") return { currentStatus: target, expectedVersion, reason: "A valid public workflow reason." };
  return { currentStatus: target, expectedVersion };
}

describe("Issue #60 Staff Ticket workflow writes", () => {
  it("claims an unassigned Ticket atomically with ASSIGNED provenance", async () => {
    const fixture = makeMutationPrisma({ ownerId: null });
    const response = await staffWrite(createApp(fixture.prisma)).post("/api/staff/tickets/42/claim").send({ expectedVersion: 7 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ticketOwner: { id: 10 }, currentStatus: "IN_PROGRESS", version: 8 });
    expect(fixture.ownerChanges).toEqual([expect.objectContaining({ ticketId: 42, previousOwnerId: null, nextOwnerId: 10, actorId: 10, reason: "ASSIGNED" })]);
  });

  it("returns an already-self claim unchanged and rejects another owner's claim", async () => {
    const self = makeMutationPrisma({ ownerId: 10 });
    const noOp = await staffWrite(createApp(self.prisma)).post("/api/staff/tickets/42/claim").send({ expectedVersion: 7 });
    expect(noOp.status).toBe(200);
    expect(noOp.body.version).toBe(7);
    expect(self.updateMany).not.toHaveBeenCalled();
    expect(self.ownerChanges).toHaveLength(0);

    const staleSelf = makeMutationPrisma({ ownerId: 10, version: 8 });
    const staleNoOp = await staffWrite(createApp(staleSelf.prisma)).post("/api/staff/tickets/42/claim").send({ expectedVersion: 7 });
    expect(staleNoOp.status).toBe(409);
    expect(staleNoOp.body.error.code).toBe("VERSION_CONFLICT");

    const other = makeMutationPrisma({ ownerId: 20 });
    const conflict = await staffWrite(createApp(other.prisma)).post("/api/staff/tickets/42/claim").send({ expectedVersion: 7 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("OWNER_CONFLICT");
    expect(other.updateMany).not.toHaveBeenCalled();
  });

  it("assigns and reassigns eligible owners with exact provenance, while same-owner is a validated no-op", async () => {
    const unassigned = makeMutationPrisma({ ownerId: null });
    const assigned = await staffWrite(createApp(unassigned.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId: 20, expectedVersion: 7 });
    expect(assigned.status).toBe(200);
    expect(assigned.body).toMatchObject({ ticketOwner: { id: 20, role: "ADMINISTRATOR" }, version: 8 });
    expect(unassigned.ownerChanges[0]).toMatchObject({ previousOwnerId: null, nextOwnerId: 20, actorId: 10, reason: "ASSIGNED" });

    const existing = makeMutationPrisma({ ownerId: 10 });
    const reassigned = await staffWrite(createApp(existing.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId: 20, expectedVersion: 7 });
    expect(reassigned.status).toBe(200);
    expect(existing.ownerChanges[0]).toMatchObject({ previousOwnerId: 10, nextOwnerId: 20, actorId: 10, reason: "REASSIGNED" });

    const same = makeMutationPrisma({ ownerId: 20 });
    const noOp = await staffWrite(createApp(same.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId: 20, expectedVersion: 7 });
    expect(noOp.status).toBe(200);
    expect(noOp.body.version).toBe(7);
    expect(same.ownerChanges).toHaveLength(0);
    expect(same.updateMany).not.toHaveBeenCalled();

    const ineligibleNoOp = makeMutationPrisma({ ownerId: 20, inactiveUserIds: [20] });
    const invalidSame = await staffWrite(createApp(ineligibleNoOp.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId: 20, expectedVersion: 7 });
    expect(invalidSame.status).toBe(400);
    expect(invalidSame.body.error.code).toBe("ASSIGNEE_INVALID");
    expect(ineligibleNoOp.updateMany).not.toHaveBeenCalled();
  });

  it("rejects manual unassignment, malformed, missing, inactive, and ineligible owner targets", async () => {
    for (const ticketOwnerId of [null, 0, -1, 2_147_483_648, "20"]) {
      const fixture = makeMutationPrisma();
      const response = await staffWrite(createApp(fixture.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId, expectedVersion: 7 });
      expect(response.status, String(ticketOwnerId)).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(fixture.transaction.ticket.findFirst).not.toHaveBeenCalled();
    }
    for (const ticketOwnerId of [1, 30, 999]) {
      const fixture = makeMutationPrisma();
      const response = await staffWrite(createApp(fixture.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId, expectedVersion: 7 });
      expect(response.status, String(ticketOwnerId)).toBe(400);
      expect(response.body.error.code).toBe("ASSIGNEE_INVALID");
      expect(fixture.updateMany).not.toHaveBeenCalled();
    }
  });

  it.each(["CLOSED", "CANCELLED"] as const)("rejects owner and priority mutations on terminal %s Tickets, including no-ops", async (status) => {
    const claim = makeMutationPrisma({ status, ownerId: null });
    const claimResponse = await staffWrite(createApp(claim.prisma)).post("/api/staff/tickets/42/claim").send({ expectedVersion: 7 });
    expect(claimResponse.status).toBe(409);
    expect(claimResponse.body.error.code).toBe("TICKET_TERMINAL");

    const owner = makeMutationPrisma({ status, ownerId: 10 });
    const ownerResponse = await staffWrite(createApp(owner.prisma)).patch("/api/staff/tickets/42/owner").send({ ticketOwnerId: 10, expectedVersion: 7 });
    expect(ownerResponse.status).toBe(409);
    expect(ownerResponse.body.error.code).toBe("TICKET_TERMINAL");

    const priority = makeMutationPrisma({ status, itPriority: "URGENT" });
    const priorityResponse = await staffWrite(createApp(priority.prisma)).patch("/api/staff/tickets/42/it-priority").send({ itPriority: "URGENT", expectedVersion: 7 });
    expect(priorityResponse.status).toBe(409);
    expect(priorityResponse.body.error.code).toBe("TICKET_TERMINAL");
  });

  it("changes only IT Priority, validates stale/enum input, and leaves identical priority unchanged", async () => {
    const changed = makeMutationPrisma({ itPriority: "URGENT" });
    const response = await staffWrite(createApp(changed.prisma)).patch("/api/staff/tickets/42/it-priority").send({ itPriority: "LOW", expectedVersion: 7 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ itPriority: "LOW", requestedPriority: "HIGH", version: 8 });
    expect(changed.updateMany.mock.calls[0][0].data).toEqual(expect.objectContaining({ itPriority: "LOW", version: { increment: 1 } }));
    expect(changed.updateMany.mock.calls[0][0].data.requestedPriority).toBeUndefined();

    const same = makeMutationPrisma({ itPriority: "URGENT" });
    const noOp = await staffWrite(createApp(same.prisma)).patch("/api/staff/tickets/42/it-priority").send({ itPriority: "URGENT", expectedVersion: 7 });
    expect(noOp.status).toBe(200);
    expect(noOp.body.version).toBe(7);
    expect(same.updateMany).not.toHaveBeenCalled();

    const invalid = makeMutationPrisma();
    const invalidResponse = await staffWrite(createApp(invalid.prisma)).patch("/api/staff/tickets/42/it-priority").send({ itPriority: "CRITICAL", expectedVersion: 7 });
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.code).toBe("VALIDATION_FAILED");

    const stale = makeMutationPrisma({ version: 8 });
    const staleResponse = await staffWrite(createApp(stale.prisma)).patch("/api/staff/tickets/42/it-priority").send({ itPriority: "LOW", expectedVersion: 7 });
    expect(staleResponse.status).toBe(409);
    expect(staleResponse.body.error.code).toBe("VERSION_CONFLICT");
    expect(stale.updateMany).not.toHaveBeenCalled();

    const staleNoOp = makeMutationPrisma({ version: 8, itPriority: "URGENT" });
    const staleNoOpResponse = await staffWrite(createApp(staleNoOp.prisma)).patch("/api/staff/tickets/42/it-priority").send({ itPriority: "URGENT", expectedVersion: 7 });
    expect(staleNoOpResponse.status).toBe(409);
    expect(staleNoOpResponse.body.error.code).toBe("VERSION_CONFLICT");
  });

  it("accepts every allowed status transition through the API", async () => {
    for (const from of ticketStatuses) {
      for (const to of allowedStatusTransitions[from]) {
        const fixture = makeMutationPrisma({ status: from as any });
        const response = await staffWrite(createApp(fixture.prisma)).patch("/api/staff/tickets/42/status").send(statusBody(to));
        expect(response.status, `${from} -> ${to}`).toBe(200);
        expect(response.body.currentStatus, `${from} -> ${to}`).toBe(to);
        expect(response.body.version, `${from} -> ${to} version`).toBe(8);
      }
    }
  });

  it("rejects every forbidden and same-state status transition through the API", async () => {
    for (const from of ticketStatuses) {
      for (const to of ticketStatuses) {
        if (allowedStatusTransitions[from].includes(to)) continue;
        const fixture = makeMutationPrisma({ status: from as any });
        const response = await staffWrite(createApp(fixture.prisma)).patch("/api/staff/tickets/42/status").send(statusBody(to));
        expect(response.status, `${from} -> ${to}`).toBe(409);
        expect(response.body.error.code, `${from} -> ${to}`).toBe("STATUS_TRANSITION_INVALID");
        expect(fixture.updateMany, `${from} -> ${to} update`).not.toHaveBeenCalled();
      }
    }
  });

  it("sets resolution/close timestamps, reopens with complete resets, and stores cancellation reasons without Actions Taken", async () => {
    const resolved = makeMutationPrisma({ status: "IN_PROGRESS" });
    const resolveResponse = await staffWrite(createApp(resolved.prisma)).patch("/api/staff/tickets/42/status").send({ currentStatus: "RESOLVED", expectedVersion: 7, resolutionSummary: "  Verified permanent resolution.  " });
    expect(resolveResponse.status).toBe(200);
    expect(resolveResponse.body).toMatchObject({ currentStatus: "RESOLVED", resolutionSummary: "Verified permanent resolution.", resolvedAt: expect.any(String), closedAt: null, lastStatusReason: null });

    const closed = makeMutationPrisma({ status: "RESOLVED" });
    const closeResponse = await staffWrite(createApp(closed.prisma)).patch("/api/staff/tickets/42/status").send({ currentStatus: "CLOSED", expectedVersion: 7 });
    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.closedAt).toEqual(expect.any(String));

    const missingResolution = makeMutationPrisma({ status: "RESOLVED" });
    missingResolution.ticket.resolutionSummary = null;
    const missingResolutionResponse = await staffWrite(createApp(missingResolution.prisma)).patch("/api/staff/tickets/42/status").send({ currentStatus: "CLOSED", expectedVersion: 7 });
    expect(missingResolutionResponse.status).toBe(409);
    expect(missingResolutionResponse.body.error.code).toBe("STATUS_TRANSITION_INVALID");

    const reopened = makeMutationPrisma({ status: "CLOSED" });
    const reopenResponse = await staffWrite(createApp(reopened.prisma)).patch("/api/staff/tickets/42/status").send({ currentStatus: "REOPENED", expectedVersion: 7, reason: "  Problem returned.  " });
    expect(reopenResponse.status).toBe(200);
    expect(reopenResponse.body).toMatchObject({
      currentStatus: "REOPENED",
      lastStatusReason: "Problem returned.",
      resolutionSummary: null,
      resolvedAt: null,
      closedAt: null,
      requesterResolvedAt: null,
      requesterResolvedBy: null,
    });

    const cancelled = makeMutationPrisma({ status: "OPEN" });
    const cancelResponse = await staffWrite(createApp(cancelled.prisma)).patch("/api/staff/tickets/42/status").send({ currentStatus: "CANCELLED", expectedVersion: 7, reason: "  Request withdrawn.  " });
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.lastStatusReason).toBe("Request withdrawn.");
    expect(cancelled.updateMany.mock.calls[0][0].data.actionsTaken).toBeUndefined();
  });

  it("rejects missing and irrelevant status fields, unsupported body/query fields, and stale writes before mutation", async () => {
    const bodies = [
      { currentStatus: "RESOLVED", expectedVersion: 7 },
      { currentStatus: "REOPENED", expectedVersion: 7 },
      { currentStatus: "CANCELLED", expectedVersion: 7, reason: "valid reason", resolutionSummary: "not permitted" },
      { currentStatus: "OPEN", expectedVersion: 7, reason: "not permitted" },
      { currentStatus: "OPEN", expectedVersion: 7, resolutionSummary: "not permitted" },
      { currentStatus: "OPEN", expectedVersion: 7, actorId: 10 },
    ];
    for (const body of bodies) {
      const fixture = makeMutationPrisma({ status: "NEW" });
      const response = await staffWrite(createApp(fixture.prisma)).patch("/api/staff/tickets/42/status").send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(fixture.transaction.ticket.findFirst).not.toHaveBeenCalled();
    }

    const query = makeMutationPrisma({ status: "NEW" });
    const queryResponse = await staffWrite(createApp(query.prisma)).patch("/api/staff/tickets/42/status?force=true").send({ currentStatus: "OPEN", expectedVersion: 7 });
    expect(queryResponse.status).toBe(400);
    expect(query.transaction.ticket.findFirst).not.toHaveBeenCalled();

    const stale = makeMutationPrisma({ status: "NEW", version: 8 });
    const staleResponse = await staffWrite(createApp(stale.prisma)).patch("/api/staff/tickets/42/status").send({ currentStatus: "OPEN", expectedVersion: 7 });
    expect(staleResponse.status).toBe(409);
    expect(staleResponse.body.error.code).toBe("VERSION_CONFLICT");
    expect(stale.updateMany).not.toHaveBeenCalled();
  });

  it("denies Requester writes before protected lookup and requires CSRF for Staff writes", async () => {
    const requester = makeMutationPrisma({ role: "REQUESTER", ownerId: null });
    const denied = await staffWrite(createApp(requester.prisma)).post("/api/staff/tickets/999999/claim").send({ expectedVersion: 7 });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(requester.transaction.ticket.findFirst).not.toHaveBeenCalled();

    const staff = makeMutationPrisma({ ownerId: null });
    const missingCsrf = await request(createApp(staff.prisma)).post("/api/staff/tickets/42/claim").set("Cookie", cookie).set("Origin", origin).send({ expectedVersion: 7 });
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_INVALID");
    expect(staff.transaction.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("returns safe correlated failures without leaking internal details", async () => {
    const cases = [
      ["post", "/api/staff/tickets/42/claim", { expectedVersion: 7 }, "TICKET_CLAIM_FAILED"],
      ["patch", "/api/staff/tickets/42/owner", { ticketOwnerId: 20, expectedVersion: 7 }, "TICKET_OWNER_UPDATE_FAILED"],
      ["patch", "/api/staff/tickets/42/it-priority", { itPriority: "LOW", expectedVersion: 7 }, "TICKET_PRIORITY_UPDATE_FAILED"],
      ["patch", "/api/staff/tickets/42/status", { currentStatus: "WAITING_FOR_REQUESTER", expectedVersion: 7 }, "TICKET_STATUS_UPDATE_FAILED"],
    ] as const;
    for (const [method, path, body, code] of cases) {
      const fixture = makeMutationPrisma({ failTransaction: true, ownerId: null });
      const response = await staffWrite(createApp(fixture.prisma))[method](path).send(body);
      expect(response.status, path).toBe(500);
      expect(response.body.error, path).toMatchObject({ code, correlationId: expect.any(String) });
      expect(JSON.stringify(response.body), path).not.toContain("private database failure");
    }
  });
});
