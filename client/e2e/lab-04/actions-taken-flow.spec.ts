import { expect, test, type Page } from "@playwright/test";
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
  await page.getByLabel("Ticket Number/Summary search").fill(TICKET_NUMBER);
  await page.getByRole("button", { name: `Open ${TICKET_NUMBER}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
}

test.describe("Lab 4 final Actions Taken flow", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("covers create, assignment, edit, complete, cancel and Requester read-only history", async ({ page }) => {
    await loginStaff(page);

    const completedDescription = "E2E final flow investigated VPN profile and validated network recovery.";
    await page.getByRole("button", { name: "Add Action", exact: true }).click();
    await page.getByLabel("Description", { exact: true }).fill(completedDescription);
    await page.getByLabel("Assignee", { exact: true }).selectOption({ label: "E2E Staff - IT STAFF" });
    await page.getByRole("button", { name: "Save Action", exact: true }).click();
    await expect(page.getByText("Action saved.", { exact: true })).toBeVisible();

    const completedCard = page.locator(".action-item").filter({ hasText: completedDescription });
    const completedAssignee = completedCard.getByText("Assignee", { exact: true }).locator("..").locator("dd");
    const completedPerformer = completedCard.getByText("Performed by", { exact: true }).locator("..").locator("dd");
    await expect(completedAssignee).toHaveText("E2E Staff");
    await expect(completedPerformer).toHaveText("E2E Staff");

    await completedCard.getByRole("button", { name: "Edit Action", exact: true }).click();
    await page.getByLabel("Assignee", { exact: true }).selectOption({ label: "E2E Administrator - ADMINISTRATOR" });
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(completedAssignee).toHaveText("E2E Administrator");
    await expect(completedPerformer).toHaveText("E2E Staff");

    await completedCard.getByRole("button", { name: "Edit Action", exact: true }).click();
    await page.getByLabel("Action status", { exact: true }).selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(completedCard.getByText("IN PROGRESS", { exact: true })).toBeVisible();

    await completedCard.getByRole("button", { name: "Edit Action", exact: true }).click();
    await page.getByLabel("Action status", { exact: true }).selectOption("COMPLETED");
    await page.getByLabel("Result", { exact: true }).fill("VPN profile was refreshed and connectivity was verified stable.");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(completedCard.getByText("COMPLETED", { exact: true })).toBeVisible();
    await expect(completedCard.getByText("Terminal · read-only", { exact: true })).toBeVisible();

    const cancelledDescription = "E2E duplicate diagnostic path no longer required after successful recovery.";
    await page.getByRole("button", { name: "Add Action", exact: true }).click();
    await page.getByLabel("Description", { exact: true }).fill(cancelledDescription);
    await page.getByRole("button", { name: "Save Action", exact: true }).click();
    const cancelledCard = page.locator(".action-item").filter({ hasText: cancelledDescription });
    await cancelledCard.getByRole("button", { name: "Edit Action", exact: true }).click();
    await page.getByLabel("Action status", { exact: true }).selectOption("CANCELLED");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(cancelledCard.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.locator(".actions-list .action-item")).toHaveCount(2);

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await enterAuthenticatedRequester(page, 1);
    await page.locator("#ticket-search").fill(TICKET_NUMBER);
    await page.locator(".tickets-table tbody tr").filter({ hasText: TICKET_NUMBER }).getByRole("button", { name: "View Ticket", exact: true }).click();
    const requesterCompletedCard = page.locator(".action-item").filter({ hasText: completedDescription });
    await expect(requesterCompletedCard.getByText(completedDescription, { exact: true })).toBeVisible();
    await expect(requesterCompletedCard.getByText("Assignee", { exact: true }).locator("..").locator("dd")).toHaveText("E2E Administrator");
    await expect(requesterCompletedCard.getByText("Performed by", { exact: true }).locator("..").locator("dd")).toHaveText("E2E Staff");
    await expect(page.getByText(cancelledDescription, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Action", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit Action", exact: true })).toHaveCount(0);
  });
});
