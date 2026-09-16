import { describe, expect, it } from "vitest";
import { canonicalDatabaseTarget, getRequiredTestDatabaseUrl } from "../../src/database-target.js";

describe("Lab 3 test database guard", () => {
  it("canonicalizes equivalent URLs without including credentials or query ordering", () => {
    const first = canonicalDatabaseTarget(
      "postgresql://alice:secret@LOCALHOST:5432/toktickit_test?connect_timeout=5&schema=public",
    );
    const second = canonicalDatabaseTarget(
      "postgresql://other:another@localhost/toktickit_test?schema=public&connect_timeout=30",
    );
    expect(first).toBe("localhost:5432/toktickit_test?schema=public");
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
      expect(() => getRequiredTestDatabaseUrl()).toThrow("different database/schema");

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
});
