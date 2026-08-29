import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app, createApp, type ReferenceDataPrisma } from "../../src/app.js";

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
    { id: 1, name: "Active Requester", isActive: true },
    { id: 2, name: "Inactive Requester", isActive: false },
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
      findMany: vi.fn(async (args: { where?: { isActive?: boolean } }) =>
        requesters
          .filter((item) => args.where?.isActive !== true || item.isActive)
          .map(({ id, name }) => ({ id, name }))),
    },
  } as unknown as ReferenceDataPrisma;
}

describe("Lab 2 reference-data endpoints", () => {
  it("returns active categories in the existing Lab 1 id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);
  });

  it("returns active related systems ordered by name then id", async () => {
    const res = await request(app).get("/api/related-systems");

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

  it("returns active development requesters only, ordered by name then id", async () => {
    const res = await request(app).get("/api/development-requesters");

    expect(res.status).toBe(200);
    expect(res.body.map((item: { name: string }) => item.name)).toEqual([
      "Anan Srisuk",
      "Benjamas Kittipong",
      "Chaiwat Somchai",
      "Daranee Ploy",
    ]);
  });

  it("excludes inactive categories, systems, and requesters", async () => {
    const prisma = makeReferenceDataPrisma();
    const testApp = createApp(prisma);

    const [categories, systems, requesters] = await Promise.all([
      request(testApp).get("/api/categories"),
      request(testApp).get("/api/related-systems"),
      request(testApp).get("/api/development-requesters"),
    ]);

    expect(categories.body).toEqual([{ id: 1, name: "Active Category" }]);
    expect(systems.body).toEqual([{ id: 1, name: "Active System" }]);
    expect(requesters.body).toEqual([{ id: 1, name: "Active Requester" }]);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(prisma.relatedSystem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(prisma.requesterUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it.each([
    ["/api/categories", "category"],
    ["/api/related-systems", "relatedSystem"],
    ["/api/development-requesters", "requesterUser"],
  ] as const)("returns a safe 500 when %s reference data fails", async (path, model) => {
    const prisma = {
      category: { findMany: vi.fn().mockRejectedValue(new Error("database unavailable")) },
      relatedSystem: { findMany: vi.fn().mockRejectedValue(new Error("database unavailable")) },
      requesterUser: { findMany: vi.fn().mockRejectedValue(new Error("database unavailable")) },
    } as unknown as ReferenceDataPrisma;

    const res = await request(createApp(prisma)).get(path);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "REFERENCE_DATA_UNAVAILABLE" });
    expect(prisma[model].findMany).toHaveBeenCalledOnce();
  });
});
