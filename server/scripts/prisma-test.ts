import { spawnSync } from "node:child_process";
import { getRequiredTestDatabaseUrl } from "../src/database-target.js";

const mode = process.argv[2];
if (mode !== "migrate" && mode !== "seed") {
  console.error("Usage: npm run prisma:migrate:test | npm run prisma:seed:test");
  process.exit(2);
}

const testDatabaseUrl = getRequiredTestDatabaseUrl();
const runner = process.platform === "win32" ? "npx.cmd" : "npx";
const args = mode === "migrate"
  ? ["--no-install", "prisma", "migrate", "deploy"]
  : ["--no-install", "tsx", "prisma/seed.ts"];
const result = spawnSync(runner, args, {
  cwd: process.cwd(),
  // The guard above has already validated TEST_DATABASE_URL against the
  // development URL. The child command receives the test URL as Prisma's
  // DATABASE_URL, so disable integration-mode re-selection inside seed.ts;
  // otherwise it would compare the same test URL to itself.
  env: { ...process.env, DATABASE_URL: testDatabaseUrl, RUN_DB_INTEGRATION: "0" },
  stdio: "inherit",
});
if (result.error) {
  console.error("Unable to run the test database command.");
  process.exit(1);
}
process.exit(result.status ?? 1);
