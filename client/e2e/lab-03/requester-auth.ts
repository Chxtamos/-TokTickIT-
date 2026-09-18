import { expect, type Page } from "@playwright/test";

const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const REQUESTER_EMAILS = [
  "anan.srisuk@example.test",
  "benjamas.kittipong@example.test",
  "chaiwat.somchai@example.test",
  "daranee.ploy@example.test",
];

function replacementPassword(requesterId: number): string {
  return `${INITIAL_PASSWORD}-requester-${requesterId}-changed`;
}

function emailForRequester(requesterId: number): string {
  const email = REQUESTER_EMAILS[requesterId - 1];
  if (!email) throw new Error(`No seeded requester email is mapped for requester id ${requesterId}`);
  return email;
}

export async function enterAuthenticatedRequester(page: Page, requesterId = 1): Promise<void> {
  await page.goto("/");
  if (await page.getByRole("heading", { name: "My Tickets", exact: true }).isVisible().catch(() => false)) return;
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();

  const email = emailForRequester(requesterId);
  const changed = replacementPassword(requesterId);
  let signedIn = false;
  for (const candidate of [INITIAL_PASSWORD, changed]) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(candidate);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    if (await page.getByRole("heading", { name: "My Tickets", exact: true }).isVisible().catch(() => false)) {
      signedIn = true;
      break;
    }
    if (await page.getByRole("heading", { name: "Change your initial password", exact: true }).isVisible().catch(() => false)) {
      await page.getByLabel("Current Password").fill(candidate);
      await page.getByLabel("New Password").fill(changed);
      await page.getByLabel("Confirm New Password").fill(changed);
      await page.getByRole("button", { name: "Save Password", exact: true }).click();
      signedIn = true;
      break;
    }
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  }

  if (!signedIn) throw new Error(`Unable to sign in seeded requester ${email}`);
  await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
}

export async function leaveAuthenticatedRequester(page: Page): Promise<void> {
  if (await page.getByRole("button", { name: "Logout", exact: true }).count()) {
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  }
}
