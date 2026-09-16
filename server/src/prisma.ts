import { PrismaClient } from "@prisma/client";
import {
  createTestPrismaClient,
  getRequiredTestDatabaseUrl,
  getRuntimeDatabaseUrl,
  isDatabaseIntegrationRequested,
  type DatabaseTarget,
} from "./database-target.js";

// Lazy singleton: the client is created on first use, not at import time.
// In an explicitly requested integration run, the test target is validated
// before this client can be created. Normal runtime continues to use
// DATABASE_URL from the environment/.env file.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    const runtimeUrl = getRuntimeDatabaseUrl();
    client = runtimeUrl
      ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } })
      : new PrismaClient();
  }
  return client;
}

export function createIntegrationPrisma(): PrismaClient {
  return createTestPrismaClient();
}

export function assertIntegrationDatabase(): string {
  return getRequiredTestDatabaseUrl();
}

export { isDatabaseIntegrationRequested };
export type { DatabaseTarget };
