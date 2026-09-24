import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "./lab3-server-helper.js";
import { enterAuthenticatedRequester } from "./requester-auth.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const TICKET_NUMBER = "TKT-2026-900011";

async function loginStaff(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e.staff@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
}

async function openFixtureTicket(page: Page) {
  await page.getByLabel("Ticket Number/Summary search").fill(TICKET_NUMBER);
  const row = page.locator(".staff-queue-table tbody tr").filter({ hasText: TICKET_NUMBER });
  if (await row.isVisible().catch(() => false)) {
    await row.getByRole("button", { name: `Open ${TICKET_NUMBER}` }).click();
  } else {
    const card = page.locator(".staff-queue-cards .ticket-card").filter({ hasText: TICKET_NUMBER });
    await card.getByRole("button", { name: `Open ${TICKET_NUMBER}` }).click();
  }
  await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
}

test.describe("E2E-03 integrated Staff workflow", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("queue -> claim -> reassign -> priority -> conversations -> file download -> resolve/close with Requester privacy", async ({ page }) => {
    await loginStaff(page);
    await openFixtureTicket(page);

    await expect(page.getByText(/Current owner:/).filter({ hasText: "Unassigned" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operational Controls", exact: true })).toBeVisible();
    await expect(page.getByText("Visible to the Requester", { exact: true })).toBeVisible();
    await expect(page.getByText(/Internal Note - visible only to IT Staff and Administrators/)).toBeVisible();

    await page.getByRole("button", { name: "Claim Ticket", exact: true }).click();
    await expect(page.getByText("Ticket claimed. Status was not changed.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Current owner:/).filter({ hasText: "E2E Staff" })).toBeVisible();

    await page.getByLabel("Eligible owner").selectOption({ label: "E2E Administrator - ADMINISTRATOR" });
    await page.getByRole("button", { name: "Reassign Owner", exact: true }).click();
    const ownerDialog = page.getByRole("dialog", { name: "Reassign Ticket owner?" });
    await expect(ownerDialog).toBeVisible();
    await ownerDialog.getByRole("button", { name: "Confirm Reassignment", exact: true }).click();
    await expect(page.getByText("Ticket owner reassigned.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Current owner:/).filter({ hasText: "E2E Administrator" })).toBeVisible();

    await page.getByLabel("IT Priority").selectOption("URGENT");
    await page.getByRole("button", { name: "Save IT Priority", exact: true }).click();
    await expect(page.getByText(/Requested Priority remains unchanged/)).toBeVisible();
    await expect(page.getByLabel("IT Priority")).toHaveValue("URGENT");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download staff-e2e.pdf", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("staff-e2e.pdf");

    await page.getByLabel("Public Comment").fill("E2E public update from Staff");
    await page.getByRole("button", { name: "Post Public Comment", exact: true }).click();
    await expect(page.getByText("Public Comment posted.", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E public update from Staff", { exact: true })).toBeVisible();
    await page.getByLabel("Public Comment").fill("E2E requester reply");
    await page.getByRole("button", { name: "Post Public Comment", exact: true }).click();
    await expect(page.getByText("E2E requester reply", { exact: true })).toBeVisible();

    await page.getByLabel("Internal Note").fill("E2E private diagnostic note");
    await page.getByRole("button", { name: "Save Internal Note", exact: true }).click();
    await expect(page.getByText("Internal Note saved.", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E private diagnostic note", { exact: true })).toBeVisible();

    await page.getByLabel("Next status").selectOption("RESOLVED");
    await page.getByLabel(/Resolution Summary/).fill("E2E resolution summary: VPN profile refreshed successfully.");
    await page.getByRole("button", { name: "Change Status", exact: true }).click();
    const resolveDialog = page.getByRole("dialog", { name: "Change status to RESOLVED?" });
    await expect(resolveDialog).toBeVisible();
    await resolveDialog.getByRole("button", { name: "Confirm Status Change", exact: true }).click();
    await expect(page.getByText("Status changed to RESOLVED.", { exact: true })).toBeVisible();

    await page.getByLabel("Next status").selectOption("CLOSED");
    await page.getByRole("button", { name: "Change Status", exact: true }).click();
    const closeDialog = page.getByRole("dialog", { name: "Change status to CLOSED?" });
    await closeDialog.getByRole("button", { name: "Confirm Status Change", exact: true }).click();
    await expect(page.getByText("Status changed to CLOSED.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Closed Tickets cannot be assigned or reprioritized/)).toBeVisible();
    await expect(page.getByLabel("IT Priority")).toBeDisabled();

    await page.getByLabel("Internal Note").fill("E2E terminal private note");
    await page.getByRole("button", { name: "Save Internal Note", exact: true }).click();
    await expect(page.getByText("E2E terminal private note", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await enterAuthenticatedRequester(page, 1);
    await page.locator("#ticket-search").fill(TICKET_NUMBER);
    const requesterRow = page.locator(".tickets-table tbody tr").filter({ hasText: TICKET_NUMBER });
    await requesterRow.getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
    await expect(page.getByText("E2E public update from Staff", { exact: true })).toBeVisible();
    await page.getByLabel("Public Comment").fill("E2E requester reply");
    await page.getByRole("button", { name: "Post Public Comment", exact: true }).click();
    await expect(page.getByText("E2E requester reply", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E private diagnostic note", { exact: true })).toHaveCount(0);
    await expect(page.getByText("E2E terminal private note", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Internal Notes", exact: true })).toHaveCount(0);
  });

  test("keeps integrated Staff Detail reachable and unclipped at the mobile breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginStaff(page);
    await openFixtureTicket(page);
    await expect(page.getByRole("heading", { name: "Operational Controls", exact: true })).toBeVisible();
    await expect(page.getByLabel("IT Priority")).toBeVisible();
    await expect(page.getByLabel("Public Comment")).toBeVisible();
    await expect(page.getByLabel("Internal Note")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
