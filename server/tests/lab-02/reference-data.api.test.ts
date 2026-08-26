import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

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
});
