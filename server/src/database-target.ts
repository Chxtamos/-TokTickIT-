import { PrismaClient } from "@prisma/client";

export type DatabaseTarget = {
  host: string;
  port: number;
  database: string;
  schema: string;
};

function parseDatabaseTarget(value: string, label: string): DatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL connection string.`);
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${label} must use a PostgreSQL connection string.`);
  }
  if (!parsed.hostname || parsed.hostname.trim().length === 0) {
    throw new Error(`${label} must include a database host.`);
  }
  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must include a valid database port.`);
  }

  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error(`${label} must include a valid database name.`);
  }
  if (!database || database.includes("/") || database === "." || database === "..") {
    throw new Error(`${label} must include a database name.`);
  }

  const schemaValues = parsed.searchParams.getAll("schema");
  if (schemaValues.length > 1) {
    throw new Error(`${label} must include at most one schema.`);
  }
  const schema = schemaValues[0]?.trim() || "public";
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema)) {
    throw new Error(`${label} must include a valid schema.`);
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port,
    database,
    schema,
  };
}

export function canonicalDatabaseTarget(value: string, label = "Database URL"): string {
  const target = parseDatabaseTarget(value, label);
  return `${target.host}:${target.port}/${target.database}?schema=${target.schema}`;
}

export function getRequiredTestDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  const developmentUrl = process.env.DATABASE_URL?.trim();
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL is required for database integration tests.");
  }
  if (!developmentUrl) {
    throw new Error("DATABASE_URL is required to verify test database isolation.");
  }

  const testTarget = parseDatabaseTarget(testUrl, "TEST_DATABASE_URL");
  const developmentTarget = parseDatabaseTarget(developmentUrl, "DATABASE_URL");
  if (!testTarget.database.toLowerCase().includes("test")) {
    throw new Error("TEST_DATABASE_URL database name must contain 'test'.");
  }
  if (canonicalDatabaseTarget(testUrl, "TEST_DATABASE_URL") === canonicalDatabaseTarget(developmentUrl, "DATABASE_URL")) {
    throw new Error("TEST_DATABASE_URL must target a different database/schema from DATABASE_URL.");
  }

  // Keep the parsed development target in this function so all target
  // components are compared, while never including credentials in errors.
  void developmentTarget;
  return testUrl;
}

export function isDatabaseIntegrationRequested(): boolean {
  return process.env.RUN_DB_INTEGRATION === "1";
}

export function getRuntimeDatabaseUrl(): string | undefined {
  if (isDatabaseIntegrationRequested()) return getRequiredTestDatabaseUrl();
  return process.env.DATABASE_URL?.trim() || undefined;
}

export function createTestPrismaClient(): PrismaClient {
  const testUrl = getRequiredTestDatabaseUrl();
  return new PrismaClient({ datasources: { db: { url: testUrl } } });
}
