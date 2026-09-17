import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const prisma = {
      category: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, name: "Account and Access" },
          { id: 2, name: "Hardware" },
          { id: 3, name: "Software" },
          { id: 4, name: "Network" },
        ]),
      },
    } as unknown as ReferenceDataPrisma;
    const res = await request(createApp(prisma)).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);

    const ids = res.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
