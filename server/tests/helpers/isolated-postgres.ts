import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getRequiredTestDatabaseUrl } from "../../src/database-target.js";

function databaseUrl(baseUrl: string, database: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${database}`;
  parsed.searchParams.set("schema", "public");
  return parsed.toString();
}

function administrationUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = "/postgres";
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

function runDatabaseSetup(url: string, mode: "migrate" | "seed"): void {
  const serverDirectory = process.cwd();
  const prismaCli = path.resolve(serverDirectory, "node_modules", "prisma", "build", "index.js");
  const tsxCli = path.resolve(serverDirectory, "node_modules", "tsx", "dist", "cli.mjs");
  const args = mode === "migrate"
    ? [prismaCli, "migrate", "deploy"]
    : [tsxCli, "prisma/seed.ts"];
  const result = spawnSync(process.execPath, args, {
    cwd: serverDirectory,
    env: {
      ...process.env,
      DATABASE_URL: url,
      RUN_DB_INTEGRATION: "0",
    },
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    throw new Error([
      `Unable to ${mode} isolated PostgreSQL test database.`,
      result.error?.message,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n"));
  }
}

export async function createIsolatedPostgresTestDatabase(label: string): Promise<{
  prisma: PrismaClient;
  databaseName: string;
  dispose: () => Promise<void>;
}> {
  const sharedTestUrl = getRequiredTestDatabaseUrl();
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 20) || "suite";
  const databaseName = `toktickit_test_${safeLabel}_${process.pid}_${randomUUID().slice(0, 8)}`.slice(0, 63);
  const admin = new PrismaClient({ datasources: { db: { url: administrationUrl(sharedTestUrl) } } });
  const isolatedUrl = databaseUrl(sharedTestUrl, databaseName);
  await admin.$connect();
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);

  let prisma: PrismaClient | null = null;
  try {
    runDatabaseSetup(isolatedUrl, "migrate");
    runDatabaseSetup(isolatedUrl, "seed");
    prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
    await prisma.$connect();
  } catch (error) {
    await admin.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
    );
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.$disconnect();
    throw error;
  }

  return {
    prisma,
    databaseName,
    dispose: async () => {
      await prisma?.$disconnect();
      await admin.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
      await admin.$disconnect();
    },
  };
}
