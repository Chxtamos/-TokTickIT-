import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "../lab-03/lab3-server-helper.js";
import { enterAuthenticatedRequester } from "../lab-03/requester-auth.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const TICKET_NUMBER = "TKT-2026-900011";

async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

test.describe("Lab 4 final dashboard journeys", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("Staff Dashboard metrics drill into authoritative Queue and Ticket Detail", async ({ page }) => {
    await login(page, "e2e.staff@example.test");
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard", exact: true })).toBeVisible();
    const unassigned = page.getByRole("button", { name: /Unassigned Tickets/ });
    await expect(unassigned).toBeVisible();
    await unassigned.click();
    await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
    await page.getByLabel("Ticket Number/Summary search").fill(TICKET_NUMBER);
    await page.getByRole("button", { name: `Open ${TICKET_NUMBER}`, exact: true }).click();
    await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
  });

  test("Requester Dashboard shows only owned work and drills into My Tickets/Detail", async ({ page }) => {
    await enterAuthenticatedRequester(page, 1);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Open Tickets/ }).click();
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await page.locator("#ticket-search").fill(TICKET_NUMBER);
    const row = page.locator(".tickets-table tbody tr").filter({ hasText: TICKET_NUMBER });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
  });

  test("Administrator can reuse the operational Staff Dashboard", async ({ page }) => {
    await login(page, "e2e.admin@example.test");
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "IT Staff Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Unassigned Tickets/ })).toBeVisible();
  });
});
