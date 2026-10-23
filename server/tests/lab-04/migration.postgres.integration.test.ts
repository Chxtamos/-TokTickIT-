import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  assertIntegrationDatabase,
  createIntegrationPrisma,
  isDatabaseIntegrationRequested,
} from "../../src/prisma.js";

const runIntegration = isDatabaseIntegrationRequested();
const testDatabaseUrl = runIntegration ? assertIntegrationDatabase() : "";
const integration = runIntegration ? describe : describe.skip;

function schemaUrl(databaseUrl: string, schema: string): string {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("schema", schema);
  return parsed.toString();
}

function applySqlFile(databaseUrl: string, file: string) {
  const prismaCli = path.resolve(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaCli, "db", "execute", "--file", file, "--url", databaseUrl], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to apply migration file ${file}:\n${result.stdout}\n${result.stderr}`);
  }
}

integration("Lab 4 forward migration PostgreSQL integration", () => {
  let admin: PrismaClient;
  let baseline: PrismaClient | undefined;
  const migrationSchema = `lab4_migration_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = schemaUrl(testDatabaseUrl, migrationSchema);

  beforeAll(async () => {
    admin = createIntegrationPrisma();
    await admin.$connect();
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${migrationSchema}"`);
  });

  afterAll(async () => {
    await baseline?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${migrationSchema}" CASCADE`);
      await admin.$disconnect();
    }
  });

  it("migrates real Lab 3-shaped rows forward without changing their IDs/values/relations", async () => {
    const migrationRoot = path.resolve(process.cwd(), "prisma", "migrations");
    const baselineMigrations = [
      "20260808161744_init",
      "20260825090000_lab2_data_model",
      "20260825110000_normalize_requester_email",
      "20260917090000_lab3_user_migration_seed",
    ];
    for (const migration of baselineMigrations) {
      applySqlFile(isolatedUrl, path.join(migrationRoot, migration, "migration.sql"));
    }

    baseline = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
    await baseline.$connect();

    const [category] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "Category" ("name", "isActive", "createdAt", "updatedAt") VALUES ('Lab4 Migration Category', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"`,
    );
    const [system] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "RelatedSystem" ("name", "isActive", "createdAt", "updatedAt") VALUES ('Lab4 Migration System', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"`,
    );
    const [requester] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "User" ("name", "email", "isActive", "role", "mustChangePassword", "version", "createdAt", "updatedAt") VALUES ('Historical Requester', 'historical.requester@example.test', true, 'REQUESTER', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"`,
    );
    const [staff] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "User" ("name", "email", "isActive", "role", "mustChangePassword", "version", "createdAt", "updatedAt") VALUES ('Historical Staff', 'historical.staff@example.test', true, 'IT_STAFF', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id"`,
    );
    const ticketUuid = randomUUID();
    const storageKey = randomUUID();
    const [ticket] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "Ticket" (
        "ticketNumber", "requesterId", "categoryId", "relatedSystemId", "ticketOwnerId",
        "summary", "description", "requestedPriority", "itPriority", "currentStatus", "version",
        "resolutionSummary", "clientRequestId", "requestPayloadHash", "createdAt", "updatedAt"
      ) VALUES (
        'TKT-L4-PREMIG-0001', ${requester.id}, ${category.id}, ${system.id}, ${staff.id},
        'Historical pre-Lab4 ticket', 'Created before the Lab 4 migration and preserved afterward.',
        'HIGH', 'URGENT', 'IN_PROGRESS', 7, NULL, '${ticketUuid}'::uuid, '${"a".repeat(64)}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING "id"`,
    );
    const [attachment] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "Attachment" ("ticketId", "originalName", "storageKey", "mimeType", "sizeBytes") VALUES (${ticket.id}, 'historical.txt', '${storageKey}'::uuid, 'text/plain', 41) RETURNING "id"`,
    );
    const [comment] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "PublicComment" ("ticketId", "authorId", "content") VALUES (${ticket.id}, ${requester.id}, 'Historical public comment.') RETURNING "id"`,
    );
    const [note] = await baseline.$queryRawUnsafe<Array<{ id: number }>>(
      `INSERT INTO "InternalNote" ("ticketId", "authorId", "content") VALUES (${ticket.id}, ${staff.id}, 'Historical internal note.') RETURNING "id"`,
    );

    const before = await baseline.$queryRawUnsafe<Array<{
      id: number;
      requesterId: number;
      categoryId: number;
      relatedSystemId: number;
      ticketOwnerId: number;
      summary: string;
      requestedPriority: string;
      itPriority: string;
      currentStatus: string;
      version: number;
    }>>(`SELECT "id", "requesterId", "categoryId", "relatedSystemId", "ticketOwnerId", "summary", "requestedPriority"::text, "itPriority"::text, "currentStatus"::text, "version" FROM "Ticket" WHERE "id" = ${ticket.id}`);

    const workflowCycleBefore = await baseline.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = '${migrationSchema}' AND table_name = 'Ticket' AND column_name = 'workflowCycle'`,
    );
    expect(workflowCycleBefore).toHaveLength(0);

    applySqlFile(isolatedUrl, path.join(migrationRoot, "20261023210000_lab4_actions_data", "migration.sql"));

    const after = await baseline.$queryRawUnsafe<Array<{
      id: number;
      requesterId: number;
      categoryId: number;
      relatedSystemId: number;
      ticketOwnerId: number;
      summary: string;
      requestedPriority: string;
      itPriority: string;
      currentStatus: string;
      version: number;
      workflowCycle: number;
    }>>(`SELECT "id", "requesterId", "categoryId", "relatedSystemId", "ticketOwnerId", "summary", "requestedPriority"::text, "itPriority"::text, "currentStatus"::text, "version", "workflowCycle" FROM "Ticket" WHERE "id" = ${ticket.id}`);

    expect(after[0]).toMatchObject({ ...before[0], workflowCycle: 1 });
    await expect(baseline.$queryRawUnsafe<Array<{ id: number; ticketId: number; storageKey: string }>>(
      `SELECT "id", "ticketId", "storageKey"::text FROM "Attachment" WHERE "id" = ${attachment.id}`,
    )).resolves.toEqual([{ id: attachment.id, ticketId: ticket.id, storageKey }]);
    await expect(baseline.$queryRawUnsafe<Array<{ id: number; ticketId: number; authorId: number; content: string }>>(
      `SELECT "id", "ticketId", "authorId", "content" FROM "PublicComment" WHERE "id" = ${comment.id}`,
    )).resolves.toEqual([{ id: comment.id, ticketId: ticket.id, authorId: requester.id, content: "Historical public comment." }]);
    await expect(baseline.$queryRawUnsafe<Array<{ id: number; ticketId: number; authorId: number; content: string }>>(
      `SELECT "id", "ticketId", "authorId", "content" FROM "InternalNote" WHERE "id" = ${note.id}`,
    )).resolves.toEqual([{ id: note.id, ticketId: ticket.id, authorId: staff.id, content: "Historical internal note." }]);

    const actionTables = await baseline.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${migrationSchema}' AND table_name IN ('ActionTaken', 'ActionTakenEvent') ORDER BY table_name`,
    );
    expect(actionTables.map(({ table_name }) => table_name)).toEqual(["ActionTaken", "ActionTakenEvent"]);
  }, 30_000);
});
