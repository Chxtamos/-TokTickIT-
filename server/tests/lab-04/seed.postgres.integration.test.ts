import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";
import { seedAllFixtures } from "../../prisma/seed-data.js";

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

  it("runs the real full seed path idempotently without overwriting operational edits", async () => {
    await seedAllFixtures(prisma);
    const first = await prisma.actionTaken.findMany({
      where: { ticket: { ticketNumber: { in: ["TKT-2026-900001", "TKT-2026-900002", "TKT-2026-900003"] } } },
      select: { id: true, ticketId: true, clientRequestId: true, status: true, assigneeId: true, version: true },
      orderBy: { id: "asc" },
    });

    const support = await prisma.requesterUser.findUniqueOrThrow({ where: { email: "support.one@example.test" } });
    const network = await prisma.category.findUniqueOrThrow({ where: { name: "Network" } });
    await prisma.requesterUser.update({
      where: { id: support.id },
      data: { name: "Operationally Renamed Support One" },
    });
    await prisma.category.update({
      where: { id: network.id },
      data: { isActive: false },
    });

    await seedAllFixtures(prisma);
    const second = await prisma.actionTaken.findMany({
      where: { ticket: { ticketNumber: { in: ["TKT-2026-900001", "TKT-2026-900002", "TKT-2026-900003"] } } },
      select: { id: true, ticketId: true, clientRequestId: true, status: true, assigneeId: true, version: true },
      orderBy: { id: "asc" },
    });
    expect(second).toEqual(first);
    await expect(prisma.requesterUser.findUnique({ where: { id: support.id } })).resolves.toMatchObject({
      name: "Operationally Renamed Support One",
    });
    await expect(prisma.category.findUnique({ where: { id: network.id } })).resolves.toMatchObject({
      isActive: false,
    });

    const tickets = await prisma.ticket.findMany({
      where: { ticketNumber: { in: ["TKT-2026-900001", "TKT-2026-900002", "TKT-2026-900003"] } },
      orderBy: { ticketNumber: "asc" },
      select: { id: true, ticketNumber: true, actionsTaken: { select: { id: true } } },
    });
    expect(tickets.map((ticket) => ticket.actionsTaken.length)).toEqual([0, 1, 2]);

    const actionIds = second.map((action) => action.id);
    await expect(prisma.actionTakenEvent.count({ where: { actionId: { in: actionIds } } })).resolves.toBe(6);
    expect(second.every((action) => action.version === 2)).toBe(true);
    expect(second.some((action) => action.status === "IN_PROGRESS" && action.assigneeId !== null)).toBe(true);

    for (const action of second) {
      const events = await prisma.actionTakenEvent.findMany({
        where: { actionId: action.id },
        orderBy: { resultingVersion: "asc" },
        select: { eventType: true, resultingVersion: true, fromStatus: true, toStatus: true },
      });
      expect(events).toEqual([
        { eventType: "CREATED", resultingVersion: 1, fromStatus: null, toStatus: "PENDING" },
        { eventType: "STATUS_CHANGED", resultingVersion: 2, fromStatus: "PENDING", toStatus: action.status },
      ]);
    }

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

    await prisma.requesterUser.update({ where: { id: support.id }, data: { name: support.name } });
    await prisma.category.update({ where: { id: network.id }, data: { isActive: network.isActive } });
  });
});
