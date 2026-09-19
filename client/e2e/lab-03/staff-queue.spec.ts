import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "./lab3-server-helper.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";

async function loginStaff(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e.staff@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
}

test.describe("Issue #59 focused Staff Queue browser flow", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("filters, opens the safe placeholder, and preserves the same-account query", async ({ page }) => {
    await loginStaff(page);
    await expect(page.getByText(/matching Tickets?/)).toBeVisible();
    await page.getByLabel("Ticket Number/Summary search").fill("TKT-2026-900011");
    const row = page.locator(".staff-queue-table tbody tr").filter({ hasText: "TKT-2026-900011" });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: /Open TKT-2026-900011/ }).click();
    await expect(page.getByRole("heading", { name: "Ticket Detail", exact: true })).toBeVisible();
    await expect(page.getByText(/reserved for Issues #62 and #75/)).toBeVisible();
    await page.getByRole("button", { name: "← Back to Queue" }).click();
    await expect(page.getByLabel("Ticket Number/Summary search")).toHaveValue("TKT-2026-900011");
  });

  test("uses equivalent Queue cards below the 992px breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginStaff(page);
    await page.getByLabel("Ticket Number/Summary search").fill("TKT-2026-900011");
    const cards = page.getByLabel("Shared Ticket Queue cards");
    await expect(cards).toBeVisible();
    await expect(cards).toContainText("TKT-2026-900011");
    await expect(cards).toContainText("Requester");
    await expect(cards).toContainText("Requested Priority");
    await expect(cards).toContainText("IT Priority");
    await expect(cards).toContainText("Owner");
  });
});
