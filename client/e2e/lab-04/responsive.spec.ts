import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "../lab-03/lab3-server-helper.js";
import { enterAuthenticatedRequester } from "../lab-03/requester-auth.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";

async function assertNoOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(widths.documentScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth + 1);
  expect(widths.bodyScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth + 1);
}

async function loginStaff(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e.staff@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard", exact: true })).toBeVisible();
}

test.describe("Lab 4 responsive and keyboard hardening", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("keeps Requester Dashboard usable without horizontal overflow at required viewports", async ({ page }) => {
    await enterAuthenticatedRequester(page, 1);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 720, height: 900 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Open Tickets/ })).toBeVisible();
      await assertNoOverflow(page);
    }
  });

  test("keeps Staff Dashboard usable without horizontal overflow at required viewports", async ({ page }) => {
    await loginStaff(page);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 720, height: 900 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { name: "IT Staff Dashboard", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Unassigned Tickets/ })).toBeVisible();
      await assertNoOverflow(page);
    }
  });

  test("keeps primary navigation and dashboard controls keyboard reachable with visible focus", async ({ page }) => {
    await enterAuthenticatedRequester(page, 1);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    let focused = page.locator(":focus");
    await expect(focused).toBeVisible();
    const firstOutline = await focused.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(firstOutline).not.toBe("none");

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (await focused.getAttribute("class").then((value) => value?.includes("dashboard-metric-card") ?? false)) break;
      await page.keyboard.press("Tab");
      focused = page.locator(":focus");
    }
    await expect(focused).toHaveClass(/dashboard-metric-card/);
    const metricOutline = await focused.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(metricOutline).not.toBe("none");
  });
});
