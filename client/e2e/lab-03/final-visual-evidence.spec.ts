import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { enterAuthenticatedRequester, leaveAuthenticatedRequester } from "./requester-auth.js";
import { resetIsolatedE2EFixtures } from "./lab3-server-helper.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const ROOT = path.resolve(process.cwd(), "..", "artifacts", "lab-03", "screenshots");

async function shot(page: Page, viewport: string, name: string) {
  if (viewport === "zoom-200") {
    await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
  }
  await assertNoHorizontalOverflow(page);
  const dir = path.join(ROOT, viewport);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

async function captureRoleSet(page: Page, label: string) {
  resetIsolatedE2EFixtures();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await shot(page, label, "01-login");

  await enterAuthenticatedRequester(page, 1);
  await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await shot(page, label, "02-requester-my-tickets");
  await leaveAuthenticatedRequester(page);

  resetIsolatedE2EFixtures();
  await login(page, "e2e.staff@example.test");
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await shot(page, label, "03-staff-queue");
  await page.getByLabel("Ticket Number/Summary search").fill("TKT-2026-900011");
  const open = page.getByRole("button", { name: /Open TKT-2026-900011/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole("heading", { name: "Operational Controls", exact: true })).toBeVisible();
  await expect(page.getByText("Internal Notes", { exact: true }).first()).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await shot(page, label, "04-staff-ticket-detail");
  await page.getByRole("button", { name: "Logout", exact: true }).click();

  resetIsolatedE2EFixtures();
  await login(page, "e2e.admin@example.test");
  await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await shot(page, label, "05-admin-user-management");
}

test.describe("Issue #65 final responsive visual evidence", () => {
  for (const viewport of [
    { label: "1440", width: 1440, height: 900 },
    { label: "768", width: 768, height: 1024 },
    { label: "390", width: 390, height: 844 },
    { label: "360", width: 360, height: 800 },
  ]) {
    test(`captures major Lab 3 screens at ${viewport.label}px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await captureRoleSet(page, viewport.label);
    });
  }

  test("captures major Lab 3 screens at 200 percent zoom", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await captureRoleSet(page, "zoom-200");
  });
});
