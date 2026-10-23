import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";
import { seedLab4Fixtures } from "../../prisma/seed-data.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

integration("Lab 4 fixture seed PostgreSQL integration", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("is idempotent and keeps deterministic zero/one/many Action fixtures", async () => {
    await seedLab4Fixtures(prisma);
    const first = await prisma.actionTaken.findMany({
      where: { ticket: { ticketNumber: { in: ["TKT-2026-900001", "TKT-2026-900002", "TKT-2026-900003"] } } },
      select: { id: true, ticketId: true, clientRequestId: true, status: true, assigneeId: true },
      orderBy: { id: "asc" },
    });
    await seedLab4Fixtures(prisma);
    const second = await prisma.actionTaken.findMany({
      where: { ticket: { ticketNumber: { in: ["TKT-2026-900001", "TKT-2026-900002", "TKT-2026-900003"] } } },
      select: { id: true, ticketId: true, clientRequestId: true, status: true, assigneeId: true },
      orderBy: { id: "asc" },
    });
    expect(second).toEqual(first);

    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: ["TKT-2026-900001", "TKT-2026-900002", "TKT-2026-900003"] } },
      orderBy: { ticketNumber: "asc" },
      select: { id: true, ticketNumber: true, actionsTaken: { select: { id: true } } },
    });
    expect(tickets.map((ticket) => ticket.actionsTaken.length)).toEqual([0, 1, 2]);

    const actionIds = second.map((action) => action.id);
    await expect(prisma.actionTakenEvent.count({ where: { actionId: { in: actionIds } } })).resolves.toBe(3);
    expect(second.some((action) => action.status === "IN_PROGRESS" && action.assigneeId !== null)).toBe(true);

    const emptyRequester = await prisma.requesterUser.findUnique({
      where: { email: "lab4.empty.requester@example.test" },
      select: { id: true },
    });
    expect(emptyRequester).not.toBeNull();
    await expect(prisma.ticket.count({ where: { requesterId: emptyRequester!.id } })).resolves.toBe(0);
    await expect(prisma.ticket.count({
      where: { requesterId: { not: emptyRequester!.id }, currentStatus: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } },
    })).resolves.toBeGreaterThan(0);
    await expect(prisma.ticket.count({
      where: { ticketOwnerId: null, currentStatus: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } },
    })).resolves.toBeGreaterThan(0);
  });
});
