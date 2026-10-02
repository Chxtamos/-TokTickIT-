import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { withMockRequesterSession } from "../helpers/auth-session.js";

function makeSeededReferenceDataPrisma(): ReferenceDataPrisma {
  return {
    category: { findMany: vi.fn().mockResolvedValue([
      { id: 1, name: "Account and Access" }, { id: 2, name: "Hardware" },
      { id: 3, name: "Software" }, { id: 4, name: "Network" },
    ]) },
    relatedSystem: { findMany: vi.fn().mockResolvedValue([
      { id: 1, name: "Campus Wi-Fi" }, { id: 2, name: "Corporate Laptop" },
      { id: 3, name: "Email" }, { id: 4, name: "Grade Submission App" },
      { id: 5, name: "LEB2 App" }, { id: 6, name: "Printer" }, { id: 7, name: "VPN" },
    ]) },
    requesterUser: { findMany: vi.fn().mockResolvedValue([
      { id: 1, name: "Anan Srisuk" }, { id: 2, name: "Benjamas Kittipong" },
      { id: 3, name: "Chaiwat Somchai" }, { id: 4, name: "Daranee Ploy" },
    ]) },
  } as unknown as ReferenceDataPrisma;
}

function makeReferenceDataPrisma(): ReferenceDataPrisma {
  const categories = [
    { id: 1, name: "Active Category", isActive: true },
    { id: 2, name: "Inactive Category", isActive: false },
  ];
  const relatedSystems = [
    { id: 1, name: "Active System", isActive: true },
    { id: 2, name: "Inactive System", isActive: false },
  ];
  const requesters = [
    { id: 1, name: "Active Requester", isActive: true, role: "REQUESTER" },
    { id: 2, name: "Inactive Requester", isActive: false, role: "REQUESTER" },
  ];

  return {
    category: {
      findMany: vi.fn(async (args: { where?: { isActive?: boolean } }) =>
        categories
          .filter((item) => args.where?.isActive !== true || item.isActive)
          .map(({ id, name }) => ({ id, name }))),
    },
    relatedSystem: {
      findMany: vi.fn(async (args: { where?: { isActive?: boolean } }) =>
        relatedSystems
          .filter((item) => args.where?.isActive !== true || item.isActive)
          .map(({ id, name }) => ({ id, name }))),
    },
    requesterUser: {
      findMany: vi.fn(async (args: { where?: { isActive?: boolean; role?: string } }) =>
        requesters
          .filter((item) => (args.where?.isActive !== true || item.isActive) && (args.where?.role === undefined || item.role === args.where.role))
          .map(({ id, name }) => ({ id, name }))),
    },
  } as unknown as ReferenceDataPrisma;
}

describe("Lab 2 reference-data endpoints", () => {
  it("returns active categories in the existing Lab 1 id order", async () => {
    const fixture = withMockRequesterSession(makeSeededReferenceDataPrisma());
    const res = await request(createApp(fixture.prisma)).get("/api/categories").set("Cookie", fixture.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);
  });

  it("returns active related systems ordered by name then id", async () => {
    const fixture = withMockRequesterSession(makeSeededReferenceDataPrisma());
    const res = await request(createApp(fixture.prisma)).get("/api/related-systems").set("Cookie", fixture.cookie);

    expect(res.status).toBe(200);
    expect(res.body.map((item: { name: string }) => item.name)).toEqual([
      "Campus Wi-Fi",
      "Corporate Laptop",
      "Email",
      "Grade Submission App",
      "LEB2 App",
      "Printer",
      "VPN",
    ]);
  });

  it("retires the Development Requester listing endpoint", async () => {
    const fixture = withMockRequesterSession(makeSeededReferenceDataPrisma());
    const res = await request(createApp(fixture.prisma))
      .get("/api/development-requesters")
      .set("Cookie", fixture.cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("excludes inactive categories, systems, and requesters", async () => {
    const prisma = makeReferenceDataPrisma();
    const fixture = withMockRequesterSession(prisma);
    const testApp = createApp(fixture.prisma);

    const [categories, systems] = await Promise.all([
      request(testApp).get("/api/categories").set("Cookie", fixture.cookie),
      request(testApp).get("/api/related-systems").set("Cookie", fixture.cookie),
    ]);

    expect(categories.body).toEqual([{ id: 1, name: "Active Category" }]);
    expect(systems.body).toEqual([{ id: 1, name: "Active System" }]);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(prisma.relatedSystem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it.each([
    ["/api/categories", "category"],
    ["/api/related-systems", "relatedSystem"],
  ] as const)("returns a safe 500 when %s reference data fails", async (path, model) => {
    const prisma = {
      category: { findMany: vi.fn().mockRejectedValue(new Error("database unavailable")) },
      relatedSystem: { findMany: vi.fn().mockRejectedValue(new Error("database unavailable")) },
      requesterUser: { findMany: vi.fn().mockRejectedValue(new Error("database unavailable")) },
    } as unknown as ReferenceDataPrisma;

    const res = await request(createApp(withMockRequesterSession(prisma).prisma)).get(path).set("Cookie", withMockRequesterSession(prisma).cookie);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: "REFERENCE_DATA_UNAVAILABLE" });
    expect(res.body.error.correlationId).toEqual(expect.any(String));
    expect(prisma[model].findMany).toHaveBeenCalledOnce();
  });
});
