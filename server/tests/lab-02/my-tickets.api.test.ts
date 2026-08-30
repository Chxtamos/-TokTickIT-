import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const ticket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery drains quickly",
  requestedPriority: "HIGH" as const,
  currentStatus: "NEW",
  createdAt: new Date("2026-08-24T10:00:00.000Z"),
  updatedAt: new Date("2026-08-25T10:00:00.000Z"),
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
};

function makePrisma(options: { tickets?: unknown[]; totalItems?: number; inactiveRequester?: boolean; fail?: boolean } = {}) {
  const findMany = options.fail ? vi.fn().mockRejectedValue(new Error("database unavailable")) : vi.fn().mockResolvedValue(options.tickets ?? [ticket]);
  const count = options.fail ? vi.fn().mockRejectedValue(new Error("database unavailable")) : vi.fn().mockResolvedValue(options.totalItems ?? 1);
  const prisma = {
    requesterUser: {
      findFirst: vi.fn().mockResolvedValue(options.inactiveRequester ? null : { id: 1 }),
    },
    ticket: {
      findMany,
      count,
    },
  } as unknown as ReferenceDataPrisma;
  return prisma;
}

describe("GET /api/tickets", () => {
  it("returns owner-scoped summaries with the contract defaults", async () => {
    const prisma = makePrisma();
    const res = await request(createApp(prisma)).get("/api/tickets").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: [{
        id: 42,
        ticketNumber: "TKT-2026-000042",
        summary: "Laptop battery drains quickly",
        category: { id: 2, name: "Hardware" },
        relatedSystem: { id: 7, name: "Corporate Laptop" },
        requestedPriority: "HIGH",
        currentStatus: "NEW",
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
      applied: {
        search: "",
        categoryId: null,
        relatedSystemId: null,
        requestedPriority: null,
        currentStatus: null,
        sortBy: "updatedAt",
        sortDirection: "desc",
      },
    });
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requesterId: 1 },
      skip: 0,
      take: 10,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    }));
  });

  it("applies search, filters, pagination, and deterministic sorting with AND semantics", async () => {
    const prisma = makePrisma({ totalItems: 21 });
    const res = await request(createApp(prisma))
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({
        search: "  VPN ",
        categoryId: "2",
        relatedSystemId: "7",
        requestedPriority: "URGENT",
        currentStatus: "NEW",
        sortBy: "ticketNumber",
        sortDirection: "asc",
        page: "2",
        pageSize: "20",
      });

    expect(res.status).toBe(200);
    expect(res.body.applied).toEqual({
      search: "VPN",
      categoryId: 2,
      relatedSystemId: 7,
      requestedPriority: "URGENT",
      currentStatus: "NEW",
      sortBy: "ticketNumber",
      sortDirection: "asc",
    });
    expect(res.body.pagination).toMatchObject({ page: 2, pageSize: 20, totalItems: 21, totalPages: 2, hasPreviousPage: true, hasNextPage: false });
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        requesterId: 1,
        categoryId: 2,
        relatedSystemId: 7,
        requestedPriority: "URGENT",
        currentStatus: "NEW",
        OR: [
          { ticketNumber: { contains: "VPN", mode: "insensitive" } },
          { summary: { contains: "VPN", mode: "insensitive" } },
        ],
      },
      skip: 20,
      take: 20,
      orderBy: [{ ticketNumber: "asc" }, { id: "asc" }],
    }));
  });

  it("returns an empty valid page beyond the final page with accurate totals", async () => {
    const prisma = makePrisma({ tickets: [], totalItems: 21 });
    const res = await request(createApp(prisma)).get("/api/tickets").set("X-Requester-Id", "1").query({ page: "4", pageSize: "10" });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 4, pageSize: 10, totalItems: 21, totalPages: 3, hasPreviousPage: true, hasNextPage: false });
  });

  it("rejects missing or inactive requester context", async () => {
    const prisma = makePrisma();
    const missing = await request(createApp(prisma)).get("/api/tickets");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");

    const inactive = await request(createApp(makePrisma({ inactiveRequester: true }))).get("/api/tickets").set("X-Requester-Id", "1");
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe("REQUESTER_CONTEXT_INVALID");
  });

  it("rejects unsupported and malformed query values", async () => {
    const prisma = makePrisma();
    const res = await request(createApp(prisma))
      .get("/api/tickets")
      .set("X-Requester-Id", "1")
      .query({ unknown: "true", categoryId: "9007199254740992", page: "0", pageSize: "15", sortDirection: ["asc", "desc"] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
    expect(res.body.error.fieldErrors).toMatchObject({
      unknown: ["This query parameter is not supported."],
      categoryId: ["Must be a safe positive integer."],
      page: ["Page must be a positive integer."],
      pageSize: ["Page size must be 10, 20, or 50."],
      sortDirection: ["This query parameter must be provided once."],
    });
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it("returns a safe error when listing fails", async () => {
    const res = await request(createApp(makePrisma({ fail: true }))).get("/api/tickets").set("X-Requester-Id", "1");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "TICKET_LIST_FAILED", message: "Unable to load Tickets." });
    expect(res.body.error.correlationId).toEqual(expect.any(String));
  });
});
