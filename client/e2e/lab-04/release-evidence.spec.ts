import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "../lab-03/lab3-server-helper.js";
import { enterAuthenticatedRequester } from "../lab-03/requester-auth.js";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const TICKET_NUMBER = "TKT-2026-900011";
const evidenceRoot = path.resolve(process.cwd(), "..", "artifacts", "lab-04", "screenshots");

async function loginStaff(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("e2e.staff@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "IT Staff Dashboard", exact: true })).toBeVisible();
}

async function openStaffTicket(page: Page) {
  await page.getByRole("link", { name: "Ticket Queue", exact: true }).click();
  await page.getByLabel("Ticket Number/Summary search").fill(TICKET_NUMBER);
  await page.getByRole("button", { name: `Open ${TICKET_NUMBER}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: TICKET_NUMBER, exact: true })).toBeVisible();
}

test.describe("Lab 4 release screenshot evidence", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("captures required role/screens at release viewports", async ({ page }) => {
    test.setTimeout(90_000);
    for (const viewport of [
      { name: "1440", width: 1440, height: 900 },
      { name: "768", width: 768, height: 1024 },
      { name: "390", width: 390, height: 844 },
      { name: "360", width: 360, height: 800 },
      { name: "zoom-200", width: 720, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginStaff(page);
      await page.screenshot({ path: path.join(evidenceRoot, viewport.name, "01-staff-dashboard.png"), fullPage: true });
      await openStaffTicket(page);
      await page.getByRole("button", { name: "Add Action", exact: true }).click();
      await page.getByLabel("Description", { exact: true }).fill("Release evidence Action form at required viewport.");
      await page.screenshot({ path: path.join(evidenceRoot, viewport.name, "02-actions-taken.png"), fullPage: true });
      await page.getByRole("button", { name: "Logout", exact: true }).click();

      await enterAuthenticatedRequester(page, 1);
      await page.getByRole("link", { name: "Dashboard", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(evidenceRoot, viewport.name, "03-requester-dashboard.png"), fullPage: true });
      await page.getByRole("button", { name: "Logout", exact: true }).click();
    }
  });
});
