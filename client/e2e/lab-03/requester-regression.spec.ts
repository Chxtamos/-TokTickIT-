import { expect, test } from "@playwright/test";
import { enterAuthenticatedRequester, leaveAuthenticatedRequester } from "./requester-auth.js";

test.describe("Lab 3 authenticated Requester regression", () => {
  test("uses separate authenticated identities and keeps the resolution indication non-status-changing", async ({ page }) => {
    await enterAuthenticatedRequester(page, 1);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.locator("#requester-select")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change Requester", exact: true })).toHaveCount(0);
    await leaveAuthenticatedRequester(page);

    await enterAuthenticatedRequester(page, 2);
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page.locator("#requester-select")).toHaveCount(0);
  });
});
