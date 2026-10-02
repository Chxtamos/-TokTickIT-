import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient, UserRole } from "@prisma/client";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession } from "../helpers/auth-session.js";

const origin = "http://127.0.0.1:5173";
const token = "staff-queue-api-session";
const tokenHash = createHash("sha256").update(token).digest("hex");
const cookie = `toktickit.sid=${token}`;

function queueTicket(id = 31) {
  return {
    id,
    ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
    summary: "Email access cannot be restored",
    requestedPriority: "HIGH" as const,
    itPriority: "URGENT" as const,
    currentStatus: "IN_PROGRESS" as const,
    version: 4,
    createdAt: new Date("2026-09-18T08:00:00.000Z"),
    updatedAt: new Date("2026-09-18T09:00:00.000Z"),
    category: { id: 2, name: "Access" },
    relatedSystem: { id: 7, name: "Email" },
    owner: { id: 10, name: "Support One", email: "support.one@example.test", role: "IT_STAFF" as const },
    requester: { id: 1, name: "Alice Requester", email: "alice@example.test", role: "REQUESTER" as const },
  };
}

function mockedPrisma(role: UserRole = "IT_STAFF", options: { total?: number; items?: ReturnType<typeof queueTicket>[] } = {}) {
  const user = {
    id: role === "REQUESTER" ? 1 : role === "IT_STAFF" ? 10 : 20,
    name: `${role} User`, email: `${role.toLowerCase()}@example.test`, role,
    isActive: true, passwordHash: "unused", mustChangePassword: false,
    passwordChangedAt: new Date(), version: 1, createdAt: new Date(), updatedAt: new Date(),
  };
  const ticket = {
    findMany: vi.fn().mockResolvedValue(options.items ?? [queueTicket()]),
    count: vi.fn().mockResolvedValue(options.total ?? 1),
  };
  const requesterUser = {
    findMany: vi.fn().mockResolvedValue([
      { id: 20, name: "Admin User", email: "admin@example.test", role: "ADMINISTRATOR" },
      { id: 10, name: "Support One", email: "support.one@example.test", role: "IT_STAFF" },
    ]),
  };
  const prisma = {
    ticket,
    requesterUser,
    category: { findMany: vi.fn().mockResolvedValue([]) },
    relatedSystem: { findMany: vi.fn().mockResolvedValue([]) },
    attachment: {},
    session: {
      findUnique: vi.fn().mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000059", tokenHash, userId: user.id,
        csrfToken: "a".repeat(64), createdAt: new Date(), lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000), user,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  } as unknown as ReferenceDataPrisma;
  return { prisma, ticket, requesterUser };
}

function get(app: ReturnType<typeof createApp>, path: string) {
  return request(app).get(path).set("Cookie", cookie);
}

describe("API-18/19 staff queue mocked contract", () => {
  beforeEach(() => { process.env.CLIENT_ORIGIN = origin; });

  it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("allows %s and returns the exact summary contract", async (role) => {
    const fixture = mockedPrisma(role);
    const response = await get(createApp(fixture.prisma), "/api/staff/tickets");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{
        id: 31, ticketNumber: "TKT-2026-000031", summary: "Email access cannot be restored",
        category: { id: 2, name: "Access" }, relatedSystem: { id: 7, name: "Email" },
        requestedPriority: "HIGH", itPriority: "URGENT", currentStatus: "IN_PROGRESS", version: 4,
        ticketOwner: { id: 10, name: "Support One", email: "support.one@example.test", role: "IT_STAFF" },
        createdAt: "2026-09-18T08:00:00.000Z", updatedAt: "2026-09-18T09:00:00.000Z",
        requester: { id: 1, name: "Alice Requester", email: "alice@example.test", role: "REQUESTER" },
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
      applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, itPriority: null, currentStatus: null, owner: "all", sortBy: "updatedAt", sortDirection: "desc" },
    });
  });

  it("combines every filter, resolves mine, and applies deterministic priority sorting", async () => {
    const fixture = mockedPrisma();
    const response = await get(createApp(fixture.prisma), "/api/staff/tickets?search=%20email%20&categoryId=2&relatedSystemId=7&requestedPriority=HIGH&itPriority=URGENT&currentStatus=IN_PROGRESS&owner=mine&sortBy=itPriority&sortDirection=asc&page=2&pageSize=20");
    expect(response.status).toBe(200);
    expect(fixture.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { ticketNumber: { contains: "email", mode: "insensitive" } },
          { summary: { contains: "email", mode: "insensitive" } },
        ],
        categoryId: 2, relatedSystemId: 7, requestedPriority: "HIGH", itPriority: "URGENT",
        currentStatus: "IN_PROGRESS", ticketOwnerId: 10,
      },
      orderBy: [{ itPriority: "asc" }, { updatedAt: "asc" }, { id: "asc" }],
      skip: 20, take: 20,
    }));
  });

  it.each([
    ["unassigned", null], ["77", 77],
  ])("maps owner=%s without owner eligibility lookup", async (owner, expected) => {
    const fixture = mockedPrisma();
    const response = await get(createApp(fixture.prisma), `/api/staff/tickets?owner=${owner}`);
    expect(response.status).toBe(200);
    expect(fixture.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketOwnerId: expected } }));
    expect(fixture.requesterUser.findMany).not.toHaveBeenCalled();
  });

  it("returns accurate empty beyond-end metadata without clamping", async () => {
    const fixture = mockedPrisma("IT_STAFF", { total: 21, items: [] });
    const response = await get(createApp(fixture.prisma), "/api/staff/tickets?page=4&pageSize=10");
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.pagination).toEqual({ page: 4, pageSize: 10, totalItems: 21, totalPages: 3, hasPreviousPage: true, hasNextPage: false });
  });

  it.each([
    "/api/staff/tickets?unknown=1",
    "/api/staff/tickets?owner=mine&owner=all",
    "/api/staff/tickets?page=9007199254740991&pageSize=50",
    "/api/staff/tickets?pageSize=25",
  ])("rejects invalid query before Ticket lookup: %s", async (path) => {
    const fixture = mockedPrisma();
    const response = await get(createApp(fixture.prisma), path);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
    expect(response.body.error.fieldErrors).toBeDefined();
    expect(fixture.ticket.findMany).not.toHaveBeenCalled();
  });

  it("forbids Requesters before parsing or lookup", async () => {
    const fixture = mockedPrisma("REQUESTER");
    const response = await get(createApp(fixture.prisma), "/api/staff/tickets?unknown=1");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(fixture.ticket.findMany).not.toHaveBeenCalled();
  });

  it("returns only active eligible owners in documented order and forbids Requesters", async () => {
    const fixture = mockedPrisma("ADMINISTRATOR");
    const response = await get(createApp(fixture.prisma), "/api/staff/ticket-owners");
    expect(response.status).toBe(200);
    expect(fixture.requesterUser.findMany).toHaveBeenCalledWith({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const invalidFixture = mockedPrisma();
    const invalid = await get(createApp(invalidFixture.prisma), "/api/staff/ticket-owners?role=IT_STAFF");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");
    expect(invalidFixture.requesterUser.findMany).not.toHaveBeenCalled();
    const requester = mockedPrisma("REQUESTER");
    const forbidden = await get(createApp(requester.prisma), "/api/staff/ticket-owners");
    expect(forbidden.status).toBe(403);
    expect(requester.requesterUser.findMany).not.toHaveBeenCalled();
  });
});

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("API-18 staff queue PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let staffId = 0;
  let otherOwnerId = 0;
  let historicalOwnerId = 0;
  let requesterId = 0;
  let categoryId = 0;
  let systemId = 0;
  let auth: Awaited<ReturnType<typeof createTestSession>>;
  const ticketIds: number[] = [];
  const userIds: number[] = [];
  const marker = randomUUID().slice(0, 8);

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const [category, system] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, select: { id: true } }),
    ]);
    if (!category || !system) throw new Error("Queue integration requires seeded active references.");
    categoryId = category.id;
    systemId = system.id;
    const [staff, otherOwner, historicalOwner, requester] = await Promise.all([
      createProvisionedTestUser(prisma, "IT_STAFF", `Queue Staff ${marker}`),
      createProvisionedTestUser(prisma, "ADMINISTRATOR", `Queue Admin ${marker}`),
      createProvisionedTestUser(prisma, "IT_STAFF", `Queue Historical ${marker}`),
      createProvisionedTestUser(prisma, "REQUESTER", `Queue Requester ${marker}`),
    ]);
    [staffId, otherOwnerId, historicalOwnerId, requesterId] = [staff.id, otherOwner.id, historicalOwner.id, requester.id];
    userIds.push(staffId, otherOwnerId, historicalOwnerId, requesterId);
    auth = await createTestSession(prisma, staffId);
    const base = new Date("2026-09-19T10:00:00.000Z");
    const fixtures = [
      { summary: `queue-${marker} combined`, requestedPriority: "HIGH" as const, itPriority: "URGENT" as const, currentStatus: "OPEN" as const, ticketOwnerId: otherOwnerId, updatedAt: new Date(base.getTime() + 6000) },
      { summary: `queue-${marker} mine urgent tie first`, requestedPriority: "LOW" as const, itPriority: "URGENT" as const, currentStatus: "NEW" as const, ticketOwnerId: staffId, updatedAt: new Date(base.getTime() + 5000) },
      { summary: `queue-${marker} mine urgent tie second`, requestedPriority: "MEDIUM" as const, itPriority: "URGENT" as const, currentStatus: "NEW" as const, ticketOwnerId: staffId, updatedAt: new Date(base.getTime() + 5000) },
      { summary: `queue-${marker} unassigned high`, requestedPriority: "HIGH" as const, itPriority: "HIGH" as const, currentStatus: "IN_PROGRESS" as const, ticketOwnerId: null, updatedAt: new Date(base.getTime() + 3000) },
      { summary: `queue-${marker} historical medium`, requestedPriority: "MEDIUM" as const, itPriority: "MEDIUM" as const, currentStatus: "WAITING_FOR_REQUESTER" as const, ticketOwnerId: historicalOwnerId, updatedAt: new Date(base.getTime() + 2000) },
      { summary: `queue-${marker} low`, requestedPriority: "LOW" as const, itPriority: "LOW" as const, currentStatus: "NEW" as const, ticketOwnerId: null, updatedAt: new Date(base.getTime() + 1000) },
    ];
    for (const [index, fixture] of fixtures.entries()) {
      const created = await prisma.ticket.create({ data: {
        ticketNumber: `TKT-Q59-${marker}-${index}`,
        requesterId, categoryId, relatedSystemId: systemId,
        summary: fixture.summary, description: "Isolated staff queue integration fixture.",
        requestedPriority: fixture.requestedPriority, itPriority: fixture.itPriority,
        currentStatus: fixture.currentStatus, ticketOwnerId: fixture.ticketOwnerId,
        clientRequestId: randomUUID(), requestPayloadHash: String(index).repeat(64).slice(0, 64),
        createdAt: new Date(base.getTime() + index * 1000), updatedAt: fixture.updatedAt,
      }});
      ticketIds.push(created.id);
    }
    await prisma.requesterUser.update({ where: { id: historicalOwnerId }, data: { isActive: false } });
  });

  afterAll(async () => {
    if (!prisma) return;
    if (ticketIds.length) await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    for (const id of userIds) await prisma.requesterUser.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("proves combined AND filters and all owner modes including historical owners", async () => {
    const app = createApp(prisma);
    const call = (path: string) => request(app).get(path).set("Cookie", auth.cookie);
    const combined = await call(`/api/staff/tickets?search=${marker}%20COMBINED&categoryId=${categoryId}&relatedSystemId=${systemId}&requestedPriority=HIGH&itPriority=URGENT&currentStatus=OPEN&owner=${otherOwnerId}`);
    expect(combined.status).toBe(200);
    expect(combined.body.items.map((item: { summary: string }) => item.summary)).toEqual([`queue-${marker} combined`]);
    const mine = await call(`/api/staff/tickets?search=queue-${marker}&owner=mine`);
    expect(mine.body.items).toHaveLength(2);
    const unassigned = await call(`/api/staff/tickets?search=queue-${marker}&owner=unassigned`);
    expect(unassigned.body.items).toHaveLength(2);
    const historical = await call(`/api/staff/tickets?search=queue-${marker}&owner=${historicalOwnerId}`);
    expect(historical.body.items).toHaveLength(1);
  });

  it("proves enum priority ranking, updatedAt/id tie rules, and pagination metadata", async () => {
    const response = await request(createApp(prisma))
      .get(`/api/staff/tickets?search=queue-${marker}&sortBy=itPriority&sortDirection=desc&pageSize=10`)
      .set("Cookie", auth.cookie);
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { itPriority: string }) => item.itPriority)).toEqual(["URGENT", "URGENT", "URGENT", "HIGH", "MEDIUM", "LOW"]);
    expect(response.body.items.slice(0, 3).map((item: { summary: string }) => item.summary)).toEqual([
      `queue-${marker} combined`, `queue-${marker} mine urgent tie second`, `queue-${marker} mine urgent tie first`,
    ]);
    const page = await request(createApp(prisma))
      .get(`/api/staff/tickets?search=queue-${marker}&sortBy=itPriority&sortDirection=asc&page=2&pageSize=10`)
      .set("Cookie", auth.cookie);
    expect(page.body.items).toEqual([]);
    expect(page.body.pagination).toEqual({ page: 2, pageSize: 10, totalItems: 6, totalPages: 1, hasPreviousPage: true, hasNextPage: false });
  });
});
