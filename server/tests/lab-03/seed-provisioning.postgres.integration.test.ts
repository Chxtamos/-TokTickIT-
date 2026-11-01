import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  assertIntegrationDatabase,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";
import { seedLab3Fixtures } from "../../prisma/seed-data.js";
import { createIsolatedPostgresTestDatabase } from "../helpers/isolated-postgres.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 3 fixture seed PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let disposeIsolatedDatabase: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const isolated = await createIsolatedPostgresTestDatabase("seed_provisioning");
    prisma = isolated.prisma;
    disposeIsolatedDatabase = isolated.dispose;
  });

  afterAll(async () => {
    await disposeIsolatedDatabase?.();
  });

  it("meets role/workflow minima and is safe to run repeatedly", async () => {
    await seedLab3Fixtures(prisma);
    const first = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: "TKT-2026-900" } },
      select: { id: true, ticketNumber: true },
      orderBy: { ticketNumber: "asc" },
    });
    await seedLab3Fixtures(prisma);
    const second = await prisma.ticket.findMany({
      where: { ticketNumber: { startsWith: "TKT-2026-900" } },
      select: { id: true, ticketNumber: true },
      orderBy: { ticketNumber: "asc" },
    });

    expect(first).toHaveLength(24);
    expect(second).toEqual(first);
    await expect(prisma.requesterUser.count({ where: { role: "REQUESTER", isActive: true } })).resolves.toBeGreaterThanOrEqual(4);
    await expect(prisma.requesterUser.count({ where: { role: "REQUESTER", isActive: false } })).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.requesterUser.count({ where: { role: "IT_STAFF", isActive: true } })).resolves.toBeGreaterThanOrEqual(3);
    await expect(prisma.requesterUser.count({ where: { role: "IT_STAFF", isActive: false } })).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.requesterUser.count({ where: { role: "ADMINISTRATOR", isActive: true } })).resolves.toBeGreaterThanOrEqual(1);
    await expect(prisma.publicComment.count({ where: { ticketId: { in: first.map((ticket) => ticket.id) } } })).resolves.toBe(24);
    await expect(prisma.internalNote.count({ where: { ticketId: { in: first.map((ticket) => ticket.id) } } })).resolves.toBe(24);
  });
});
