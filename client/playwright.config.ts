import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(clientDirectory, "..");
const serverDirectory = path.join(repositoryDirectory, "server");

export default defineConfig({
  testDir: path.join(clientDirectory, "e2e"),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1",
      cwd: clientDirectory,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      cwd: serverDirectory,
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: "3000",
        DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public",
        ATTACHMENT_STORAGE_DIR: path.join(repositoryDirectory, "e2e", ".tmp", "attachments"),
      },
    },
  ],
});
