import { describe, expect, it } from "vitest";
import { canonicalDatabaseTarget, getRequiredTestDatabaseUrl, getRuntimeDatabaseUrl } from "../../src/database-target.js";
import { runPrismaTest, type ChildRunner } from "../../scripts/prisma-test.js";

describe("Lab 3 test database guard", () => {
  it("canonicalizes equivalent URLs without including credentials or query ordering", () => {
    const first = canonicalDatabaseTarget(
      "postgresql://alice:secret@LOCALHOST:5432/toktickit_test?connect_timeout=5&schema=public",
    );
    const second = canonicalDatabaseTarget(
      "postgresql://other:another@localhost/toktickit_test?schema=public&connect_timeout=30",
    );
    expect(first).toBe("localhost:5432/toktickit_test");
    expect(second).toBe(first);
    expect(first).not.toContain("secret");
  });

  it("rejects a missing, non-PostgreSQL, unsafe, or same test target", () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;
    try {
      delete process.env.DATABASE_URL;
      process.env.TEST_DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public";
      expect(() => getRequiredTestDatabaseUrl()).toThrow("DATABASE_URL is required");

      process.env.DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public";
      process.env.TEST_DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public";
      expect(() => getRequiredTestDatabaseUrl()).toThrow("different PostgreSQL database");

      process.env.DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public";
      process.env.TEST_DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=test";
      expect(() => getRequiredTestDatabaseUrl()).toThrow("different PostgreSQL database");

      process.env.TEST_DATABASE_URL = "mysql://toktickit:toktickit@localhost:3306/toktickit_test";
      expect(() => getRequiredTestDatabaseUrl()).toThrow("PostgreSQL");

      process.env.TEST_DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit_dev?schema=public";
      expect(() => getRequiredTestDatabaseUrl()).toThrow("must contain 'test'");
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
    }
  });

  it("fails closed when TEST_DATABASE_URL is absent", () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;
    try {
      process.env.DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public";
      delete process.env.TEST_DATABASE_URL;
      expect(() => getRequiredTestDatabaseUrl()).toThrow("TEST_DATABASE_URL is required");
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
    }
  });

  it("does not fall back to DATABASE_URL when integration runtime selection lacks a test URL", () => {
    const originalRun = process.env.RUN_DB_INTEGRATION;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;
    try {
      process.env.RUN_DB_INTEGRATION = "1";
      process.env.DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public";
      delete process.env.TEST_DATABASE_URL;
      expect(() => getRuntimeDatabaseUrl()).toThrow("TEST_DATABASE_URL is required");
    } finally {
      if (originalRun === undefined) delete process.env.RUN_DB_INTEGRATION;
      else process.env.RUN_DB_INTEGRATION = originalRun;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
    }
  });

  it("does not spawn Prisma migrate or seed when the guard rejects configuration", () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;
    let spawnCount = 0;
    const runner: ChildRunner = () => {
      spawnCount += 1;
      return { status: 0 };
    };
    try {
      process.env.DATABASE_URL = "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public";
      delete process.env.TEST_DATABASE_URL;
      expect(() => runPrismaTest("migrate", runner)).toThrow("TEST_DATABASE_URL is required");
      expect(spawnCount).toBe(0);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL;
      else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
    }
  });
});
