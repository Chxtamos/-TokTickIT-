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
    await expect(page.getByLabel("Email")).toBeEnabled();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(candidate);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // Login is asynchronous.  Do not start the fallback-password attempt while
    // the first submission still owns the disabled form; wait for one of the
    // three authoritative post-submit states instead.
    const outcome = await Promise.race([
      page.getByRole("heading", { name: "My Tickets", exact: true }).waitFor({ state: "visible" }).then(() => "workspace" as const),
      page.getByRole("heading", { name: "Change your initial password", exact: true }).waitFor({ state: "visible" }).then(() => "change-password" as const),
      page.getByRole("alert").waitFor({ state: "visible" }).then(() => "rejected" as const),
    ]);

    if (outcome === "workspace") {
      signedIn = true;
      break;
    }
    if (outcome === "change-password") {
      await page.getByLabel("Current Password").fill(candidate);
      await page.getByRole("textbox", { name: "New Password", exact: true }).fill(changed);
      await page.getByRole("textbox", { name: "Confirm New Password", exact: true }).fill(changed);
      await page.getByRole("button", { name: "Save Password", exact: true }).click();
      await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
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
