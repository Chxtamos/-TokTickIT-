import { expect, test } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "./lab3-server-helper.js";
import { enterAuthenticatedRequester, leaveAuthenticatedRequester } from "./requester-auth.js";

test.describe("Lab 3 authenticated Requester regression", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("uses separate authenticated identities and keeps the resolution indication non-status-changing", async ({ page }) => {
    await enterAuthenticatedRequester(page, 1);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.getByText("Anan Srisuk · Requester", { exact: true })).toBeVisible();
    await expect(page.locator("#requester-select")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change Requester", exact: true })).toHaveCount(0);

    await page.locator("#ticket-search").fill("TKT-2026-900011");
    const ticketRow = page.locator(".tickets-table tbody tr").filter({ hasText: "TKT-2026-900011" });
    await expect(ticketRow).toBeVisible();
    await ticketRow.getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "TKT-2026-900011", exact: true })).toBeVisible();
    const statusField = page.locator(".detail-grid > div").filter({ has: page.getByText("Current Status", { exact: true }) });
    await expect(statusField.getByText("IN_PROGRESS", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Problem Appears Resolved", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Indicate that the problem appears resolved?" });
    await expect(dialog).toBeVisible();
    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" && response.url().endsWith("/resolution-indication"),
    );
    await dialog.getByRole("button", { name: "Confirm indication", exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const saved = await response.json() as { currentStatus: string; requesterResolvedAt: string | null };
    expect(saved.currentStatus).toBe("IN_PROGRESS");
    expect(saved.requesterResolvedAt).toBeTruthy();
    await expect(page.getByText(/You indicated that the problem appeared resolved on/)).toBeVisible();
    await expect(statusField.getByText("IN_PROGRESS", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Problem Appears Resolved", exact: true })).toHaveCount(0);

    await leaveAuthenticatedRequester(page);

    await enterAuthenticatedRequester(page, 2);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.getByText("Benjamas Kittipong · Requester", { exact: true })).toBeVisible();
    await expect(page.locator("#requester-select")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change Requester", exact: true })).toHaveCount(0);
    await page.locator("#ticket-search").fill("TKT-2026-900011");
    await expect(page.getByRole("status").filter({ hasText: /You have not created any tickets yet|No tickets match the current search or filters/ })).toBeVisible();
    await expect(page.getByText("TKT-2026-900011", { exact: true })).toHaveCount(0);
  });
});
