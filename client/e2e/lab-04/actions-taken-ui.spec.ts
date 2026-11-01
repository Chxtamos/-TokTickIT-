import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "../lab-03/lab3-server-helper.js";
import { enterAuthenticatedRequester } from "../lab-03/requester-auth.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const TICKET_NUMBER = "TKT-2026-900011";

async function loginStaff(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e.staff@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Ticket Queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
}

async function openFixtureTicket(page: Page) {
  await page.getByLabel("Ticket Number/Summary search").fill(TICKET_NUMBER);
  const openButton = page.getByRole("button", { name: `Open ${TICKET_NUMBER}`, exact: true });
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
}

async function assertWithinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function assertNoPageOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(widths.documentScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth + 1);
  expect(widths.bodyScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth + 1);
}

test.describe("Lab 4 Actions Taken Ticket Detail UI", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("Staff creates/edits multiple Actions and Requester sees the same history read-only", async ({ page }) => {
    await loginStaff(page);
    await openFixtureTicket(page);

    const firstDescription = "E2E collected VPN diagnostics and confirmed the affected profile.";
    await page.getByRole("button", { name: "Add Action", exact: true }).click();
    await page.getByLabel("Description", { exact: true }).fill(firstDescription);
    await page.getByLabel("Assignee", { exact: true }).selectOption({ label: "E2E Staff - IT STAFF" });
    await page.getByLabel("Follow-up required", { exact: true }).check();
    await page.getByLabel("Follow-up note", { exact: true }).fill("Ask the Requester to verify stability after the profile refresh.");
    await page.getByLabel("Attachment notes", { exact: true }).fill("See staff-e2e.pdf on the Ticket.");
    await page.getByRole("button", { name: "Save Action", exact: true }).click();
    await expect(page.getByText("Action saved.", { exact: true })).toBeVisible();
    await expect(page.getByText(firstDescription, { exact: true })).toBeVisible();

    const secondDescription = "E2E prepared a second operational Action for history ordering.";
    await page.getByRole("button", { name: "Add Action", exact: true }).click();
    await page.getByLabel("Description", { exact: true }).fill(secondDescription);
    await page.getByRole("button", { name: "Save Action", exact: true }).click();
    await expect(page.getByText(secondDescription, { exact: true })).toBeVisible();
    await expect(page.locator(".actions-list .action-item")).toHaveCount(2);

    const firstCard = page.locator(".action-item").filter({ hasText: firstDescription });
    await firstCard.getByRole("button", { name: "Edit Action", exact: true }).click();
    await page.getByLabel("Action status", { exact: true }).selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByText("Action updated.", { exact: true })).toBeVisible();
    await expect(firstCard.getByText("IN PROGRESS", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await enterAuthenticatedRequester(page, 1);
    await page.locator("#ticket-search").fill(TICKET_NUMBER);
    const requesterRow = page.locator(".tickets-table tbody tr").filter({ hasText: TICKET_NUMBER });
    await requesterRow.getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
    await expect(page.getByText(firstDescription, { exact: true })).toBeVisible();
    await expect(page.getByText(secondDescription, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Action", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit Action", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Action status", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Assignee", { exact: true })).toHaveCount(0);
  });

  test("keeps the Actions Taken form unclipped with no page overflow at required viewports", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginStaff(page);
    await openFixtureTicket(page);
    await page.getByRole("button", { name: "Add Action", exact: true }).click();
    await page.getByLabel("Description", { exact: true }).fill("Responsive verification Action for required Lab 4 viewports.");

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 720, height: 900 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { name: "Actions Taken", exact: true })).toBeVisible();
      await expect(page.getByLabel("Description", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Assignee", { exact: true })).toBeVisible();
      await assertWithinViewport(page, page.locator(".actions-taken-card"));
      await assertWithinViewport(page, page.locator(".action-form"));
      await assertWithinViewport(page, page.getByRole("button", { name: "Save Action", exact: true }));
      await assertNoPageOverflow(page);
    }
  });
});
