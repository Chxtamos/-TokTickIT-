import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRequiredTestDatabaseUrl } from "../src/database-target.js";

export type ChildRunner = (
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
) => { status: number | null; error?: Error };

const defaultRunner: ChildRunner = (command, args, options) => spawnSync(command, args, options);

export function runPrismaTest(mode: string | undefined, runner: ChildRunner = defaultRunner): number {
  if (mode !== "migrate" && mode !== "seed") {
    console.error("Usage: npm run prisma:migrate:test | npm run prisma:seed:test");
    return 2;
  }

  // This validation intentionally runs before spawnSync. A missing or unsafe
  // target therefore cannot reach Prisma migrate/seed at all.
  const testDatabaseUrl = getRequiredTestDatabaseUrl();
  const commandRunner = process.execPath;
  const prismaCli = path.resolve(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const tsxCli = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const args = mode === "migrate"
    ? [prismaCli, "migrate", "deploy"]
    : [tsxCli, "prisma/seed.ts"];
  const result = runner(commandRunner, args, {
    cwd: process.cwd(),
    // The guard above validated TEST_DATABASE_URL against the development
    // URL. The child receives the test URL as DATABASE_URL, so disable the
    // runtime selector's integration re-selection inside seed.ts.
    env: { ...process.env, DATABASE_URL: testDatabaseUrl, RUN_DB_INTEGRATION: "0" },
    stdio: "inherit",
  });
  if (result.error) {
    console.error("Unable to run the test database command.");
    return 1;
  }
  return result.status ?? 1;
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(runPrismaTest(process.argv[2]));
}
