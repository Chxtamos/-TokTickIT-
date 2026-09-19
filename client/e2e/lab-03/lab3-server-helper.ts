import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const serverDirectory = path.join(repositoryDirectory, "server");
const tsxCli = path.join(serverDirectory, "node_modules", "tsx", "dist", "cli.mjs");

export function runLab3ServerHelper(script: string, ...args: string[]): void {
  const result = spawnSync(process.execPath, [tsxCli, path.join(serverDirectory, "scripts", "lab3", script), ...args], {
    cwd: serverDirectory,
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${script} failed`);
}

export function resetIsolatedE2EFixtures(): void {
  runLab3ServerHelper("provision-e2e-requesters.ts");
}
