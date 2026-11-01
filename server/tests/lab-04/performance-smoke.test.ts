import { performance } from "node:perf_hooks";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 4 dashboard performance smoke", () => {
  it("keeps authoritative dashboard DTOs bounded and responsive on the representative database", async () => {
    const prisma = createIntegrationPrisma();
    await prisma.$connect();
    const staff = await createProvisionedTestUser(prisma, "IT_STAFF", "Performance Smoke Staff");
    const auth = await createTestSession(prisma, staff.id);
    try {
      const started = performance.now();
      const response = await request(createApp(prisma)).get("/api/staff/dashboard").set("Cookie", auth.cookie);
      const elapsedMs = performance.now() - started;
      expect(response.status).toBe(200);
      expect(response.body.recentOrUrgent.length).toBeLessThanOrEqual(10);
      expect(response.body.myOpenActionItems.length).toBeLessThanOrEqual(10);
      expect(response.body.myRecentActions.length).toBeLessThanOrEqual(5);
      expect(Buffer.byteLength(JSON.stringify(response.body), "utf8")).toBeLessThan(100_000);
      expect(elapsedMs).toBeLessThan(3_000);
    } finally {
      await prisma.requesterUser.deleteMany({ where: { id: staff.id } });
      await prisma.$disconnect();
    }
  });
});
