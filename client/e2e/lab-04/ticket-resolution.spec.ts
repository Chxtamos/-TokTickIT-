import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "../lab-03/lab3-server-helper.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const TICKET_NUMBER = "TKT-2026-900011";

async function openStaffTicket(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e.staff@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.getByRole("link", { name: "Ticket Queue", exact: true }).click();
  await page.getByLabel("Ticket Number/Summary search").fill(TICKET_NUMBER);
  await page.getByRole("button", { name: `Open ${TICKET_NUMBER}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
}

async function attemptResolve(page: Page, summary: string) {
  await page.locator("#staff-next-status").selectOption("RESOLVED");
  await page.locator("#staff-resolution-summary").fill(summary);
  await page.getByRole("button", { name: "Change Status", exact: true }).click();
  await page.getByRole("button", { name: "Confirm Status Change", exact: true }).click();
}

async function createCompletedAction(page: Page, description: string, result: string) {
  await page.getByRole("button", { name: "Add Action", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill(description);
  await page.getByRole("button", { name: "Save Action", exact: true }).click();
  const card = page.locator(".action-item").filter({ hasText: description });
  await card.getByRole("button", { name: "Edit Action", exact: true }).click();
  await page.getByLabel("Action status", { exact: true }).selectOption("COMPLETED");
  await page.getByLabel("Result", { exact: true }).fill(result);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(card.getByText("COMPLETED", { exact: true })).toBeVisible();
}

test.describe("Lab 4 final Ticket resolution lifecycle", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("enforces the resolution gate across close, reopen and a new workflow cycle", async ({ page }) => {
    test.setTimeout(90_000);
    await openStaffTicket(page);

    await attemptResolve(page, "Initial resolution attempt before any current-cycle completed work.");
    await expect(page.getByRole("alert")).toContainText("Complete all current-cycle Actions");
    await expect(page.getByText("Current status:").locator(".." )).toContainText("IN PROGRESS");

    await createCompletedAction(
      page,
      "E2E current-cycle work completed before first resolution.",
      "Connectivity validated and Requester-impacting issue resolved.",
    );
    await attemptResolve(page, "Connectivity restored after completing the required current-cycle work.");
    await expect(page.getByText("Status changed to RESOLVED.", { exact: true })).toBeVisible();

    await page.locator("#staff-next-status").selectOption("CLOSED");
    await page.getByRole("button", { name: "Change Status", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Status Change", exact: true }).click();
    await expect(page.getByText("Status changed to CLOSED.", { exact: true })).toBeVisible();

    await page.locator("#staff-next-status").selectOption("REOPENED");
    await page.locator("#staff-status-reason").fill("Requester reports the problem returned after closure.");
    await page.getByRole("button", { name: "Change Status", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Status Change", exact: true }).click();
    await expect(page.getByText("Status changed to REOPENED.", { exact: true })).toBeVisible();

    await page.locator("#staff-next-status").selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Change Status", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Status Change", exact: true }).click();
    await expect(page.getByText("Status changed to IN PROGRESS.", { exact: true })).toBeVisible();

    await attemptResolve(page, "Second resolution attempt must not reuse prior-cycle work evidence.");
    await expect(page.getByRole("alert")).toContainText("Complete all current-cycle Actions");

    await createCompletedAction(
      page,
      "E2E reopened-cycle diagnostic and recovery work completed.",
      "Reopened cycle received new verified completion evidence.",
    );
    await attemptResolve(page, "Reopened cycle resolved using only new current-cycle completed work.");
    await expect(page.getByText("Status changed to RESOLVED.", { exact: true })).toBeVisible();
  });
});
