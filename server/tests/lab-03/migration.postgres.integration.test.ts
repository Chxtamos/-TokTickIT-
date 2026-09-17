import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";
import { seedLab3Fixtures } from "../../prisma/seed-data.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;

const markerTicketNumber = "TKT-2026-899999";
const storageDirectory = process.env.TEST_ATTACHMENT_STORAGE_DIR
  ?? path.resolve(process.cwd(), ".test-storage", "migration-integration");

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

integration("Lab 3 forward migration PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let sentinelTicketId: number | undefined;
  let sentinelAttachmentId: number | undefined;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    await prisma.ticket.deleteMany({ where: { ticketNumber: markerTicketNumber } });
    await rm(storageDirectory, { recursive: true, force: true });
    await mkdir(storageDirectory, { recursive: true });
  });

  afterAll(async () => {
    if (prisma) {
      if (sentinelTicketId) await prisma.ticket.delete({ where: { id: sentinelTicketId } }).catch(() => undefined);
      await prisma.$disconnect();
    }
    await rm(storageDirectory, { recursive: true, force: true });
  });

  it("keeps the renamed User table, migrated constraints and historical rows intact", async () => {
    const [requester, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findFirst({ where: { role: "REQUESTER", isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
    ]);
    if (!requester || !category || !relatedSystem) {
      throw new Error("Migration integration requires an active Requester and reference fixtures.");
    }

    const userTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'User'
    `;
    expect(userTable).toEqual([{ table_name: "User" }]);

    const userColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'User'
        AND column_name IN ('role', 'passwordHash', 'mustChangePassword', 'passwordChangedAt', 'version')
    `;
    expect(userColumns.map(({ column_name }) => column_name)).toEqual(expect.arrayContaining([
      "role",
      "passwordHash",
      "mustChangePassword",
      "passwordChangedAt",
      "version",
    ]));

    const foreignKeys = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = current_schema()
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name IN (
          'Ticket_requesterId_fkey', 'Ticket_ticketOwnerId_fkey',
          'Ticket_requesterResolvedById_fkey', 'Attachment_ticketId_fkey',
          'Attachment_removedByRequesterId_fkey', 'PublicComment_ticketId_fkey',
          'PublicComment_authorId_fkey', 'InternalNote_ticketId_fkey',
          'InternalNote_authorId_fkey'
        )
    `;
    expect(foreignKeys.map(({ constraint_name }) => constraint_name)).toEqual(expect.arrayContaining([
      "Ticket_requesterId_fkey",
      "Ticket_ticketOwnerId_fkey",
      "Ticket_requesterResolvedById_fkey",
      "Attachment_ticketId_fkey",
      "Attachment_removedByRequesterId_fkey",
      "PublicComment_ticketId_fkey",
      "PublicComment_authorId_fkey",
      "InternalNote_ticketId_fkey",
      "InternalNote_authorId_fkey",
    ]));

    const priorityMismatches = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Ticket" WHERE "itPriority" <> "requestedPriority"
    `;
    expect(priorityMismatches).toHaveLength(0);

    const sequenceBefore = await prisma.$queryRaw<Array<{ last_value: bigint }>>`
      SELECT last_value FROM "TicketNumberSequence"
    `;

    const fileBytes = Buffer.from("Lab 3 migration preservation fixture\n", "utf8");
    const storageKey = randomUUID();
    const storagePath = path.join(storageDirectory, `${storageKey}.txt`);
    await writeFile(storagePath, fileBytes);
    const fileHashBefore = sha256(fileBytes);
    const historicalTicket = await prisma.ticket.create({
      data: {
        ticketNumber: markerTicketNumber,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Historical migration preservation fixture",
        description: "A representative historical ticket retained across the Lab 3 forward migration.",
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        currentStatus: "CLOSED",
        version: 7,
        resolutionSummary: "Historical resolution retained.",
        resolvedAt: new Date("2026-08-25T10:00:00.000Z"),
        closedAt: new Date("2026-08-26T10:00:00.000Z"),
        clientRequestId: randomUUID(),
        requestPayloadHash: "c".repeat(64),
      },
    });
    sentinelTicketId = historicalTicket.id;
    const historicalAttachment = await prisma.attachment.create({
      data: {
        ticketId: historicalTicket.id,
        originalName: "migration-fixture.txt",
        storageKey,
        mimeType: "text/plain",
        sizeBytes: fileBytes.length,
        removedAt: new Date("2026-08-27T10:00:00.000Z"),
        removedReason: "Historical removal retained.",
        removedByRequesterId: requester.id,
      },
    });
    sentinelAttachmentId = historicalAttachment.id;

    await seedLab3Fixtures(prisma);

    const preservedTicket = await prisma.ticket.findUnique({ where: { id: historicalTicket.id } });
    expect(preservedTicket).toMatchObject({
      id: historicalTicket.id,
      ticketNumber: markerTicketNumber,
      requesterId: requester.id,
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "CLOSED",
      version: 7,
      resolutionSummary: "Historical resolution retained.",
    });
    const preservedAttachment = await prisma.attachment.findUnique({ where: { id: historicalAttachment.id } });
    expect(preservedAttachment).toMatchObject({
      id: historicalAttachment.id,
      ticketId: historicalTicket.id,
      storageKey,
      removedAt: expect.any(Date),
      removedReason: "Historical removal retained.",
      removedByRequesterId: requester.id,
    });
    const fileHashAfter = sha256(await readFile(storagePath));
    expect(fileHashAfter).toBe(fileHashBefore);

    const sequenceAfter = await prisma.$queryRaw<Array<{ last_value: bigint }>>`
      SELECT last_value FROM "TicketNumberSequence"
    `;
    expect(sequenceAfter[0].last_value).toBeGreaterThanOrEqual(sequenceBefore[0].last_value);
    expect(sequenceAfter[0].last_value).toBeGreaterThanOrEqual(900024n);
  });
});
