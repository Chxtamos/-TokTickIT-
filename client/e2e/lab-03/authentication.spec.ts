import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures, runLab3ServerHelper } from "./lab3-server-helper.js";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const CLIENT_ORIGIN = "http://127.0.0.1:5173";
const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";
const REPLACEMENT_PASSWORD = `${INITIAL_PASSWORD}-browser-replacement`;

function cookiePair(header: string): string {
  const pair = header.split(";")[0];
  if (!pair.includes("=")) throw new Error("Authentication response did not include a session cookie.");
  return pair;
}

async function login(request: APIRequestContext, email: string, password: string) {
  return request.post(`${API_URL}/api/auth/login`, {
    headers: { Origin: CLIENT_ORIGIN },
    data: { email, password },
  });
}

async function browserLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

test.describe("Lab 3 authentication", () => {
  test.beforeEach(() => resetIsolatedE2EFixtures());

  test("rejects invalid and inactive login and enforces the restricted 15-minute boundary", async ({ request }) => {
    const invalid = await login(request, "missing@example.test", "wrong password value");
    expect(invalid.status()).toBe(401);
    expect((await invalid.json()).error.code).toBe("INVALID_CREDENTIALS");

    const inactive = await login(request, "inactive.requester@example.test", INITIAL_PASSWORD);
    expect(inactive.status()).toBe(401);
    expect((await inactive.json()).error.code).toBe("INVALID_CREDENTIALS");

    const email = "e2e.boundary.requester@example.test";
    const valid = await login(request, email, INITIAL_PASSWORD);
    expect(valid.status()).toBe(200);
    const body = await valid.json();
    expect(body.user).toMatchObject({ role: "REQUESTER", mustChangePassword: true });
    expect(body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const cookieHeader = valid.headers()["set-cookie"];
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("Max-Age=900");
    const cookie = cookiePair(cookieHeader);

    const me = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(me.status()).toBe(200);

    runLab3ServerHelper("set-e2e-session-boundary.ts", "absolute", email);
    const expired = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(expired.status()).toBe(401);
    expect((await expired.json()).error.code).toBe("SESSION_REQUIRED");
  });

  test("changes the mandatory password in the browser, lands Requester, and denies logout replay", async ({ page, request }) => {
    const email = "e2e.auth.requester@example.test";
    await browserLogin(page, email, INITIAL_PASSWORD);
    await expect(page.getByRole("heading", { name: "Change your initial password", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);

    await page.getByLabel("Current Password").fill(INITIAL_PASSWORD);
    await page.getByRole("textbox", { name: "New Password", exact: true }).fill(REPLACEMENT_PASSWORD);
    await page.getByRole("textbox", { name: "Confirm New Password", exact: true }).fill(REPLACEMENT_PASSWORD);
    await page.getByRole("button", { name: "Save Password", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/requester\/tickets$/);

    const sessionCookie = (await page.context().cookies()).find((cookie) => cookie.name === "toktickit.sid");
    expect(sessionCookie).toBeDefined();
    const replayCookie = `${sessionCookie!.name}=${sessionCookie!.value}`;
    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();

    const replay = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: replayCookie } });
    expect(replay.status()).toBe(401);
    expect((await replay.json()).error.code).toBe("SESSION_REQUIRED");

    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Unable to sign in with those credentials.");

    await page.getByRole("textbox", { name: "Password", exact: true }).fill(REPLACEMENT_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My Tickets", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/requester\/tickets$/);
  });

  test("lands IT Staff and Administrator in their role workspaces", async ({ page }) => {
    await browserLogin(page, "e2e.staff@example.test", INITIAL_PASSWORD);
    await expect(page.getByRole("heading", { name: "Ticket Queue", exact: true })).toBeVisible();
    await expect(page.getByText("E2E Staff · IT Staff", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/tickets$/);

    await page.getByRole("button", { name: "Logout", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByLabel("Email").fill("e2e.admin@example.test");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(INITIAL_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
    await expect(page.getByText("E2E Administrator · Administrator", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test("enforces normal-session idle and absolute expiry boundaries", async ({ request }) => {
    const email = "e2e.normal-expiry.requester@example.test";
    const replacement = `${INITIAL_PASSWORD}-normal-expiry`;
    const restricted = await login(request, email, INITIAL_PASSWORD);
    expect(restricted.status()).toBe(200);
    const restrictedBody = await restricted.json();
    const restrictedCookie = cookiePair(restricted.headers()["set-cookie"]);

    const changed = await request.post(`${API_URL}/api/auth/change-password`, {
      headers: {
        Origin: CLIENT_ORIGIN,
        Cookie: restrictedCookie,
        "X-CSRF-Token": restrictedBody.csrfToken,
      },
      data: { currentPassword: INITIAL_PASSWORD, newPassword: replacement, confirmPassword: replacement },
    });
    expect(changed.status()).toBe(200);
    expect((await changed.json()).user).toMatchObject({ mustChangePassword: false });
    expect(changed.headers()["set-cookie"]).toContain("Max-Age=28800");
    const idleCookie = cookiePair(changed.headers()["set-cookie"]);
    expect((await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: idleCookie } })).status()).toBe(200);

    runLab3ServerHelper("set-e2e-session-boundary.ts", "idle", email);
    const idleExpired = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: idleCookie } });
    expect(idleExpired.status()).toBe(401);
    expect((await idleExpired.json()).error.code).toBe("SESSION_REQUIRED");

    const normal = await login(request, email, replacement);
    expect(normal.status()).toBe(200);
    expect((await normal.json()).user).toMatchObject({ mustChangePassword: false });
    const absoluteCookie = cookiePair(normal.headers()["set-cookie"]);
    runLab3ServerHelper("set-e2e-session-boundary.ts", "absolute", email);
    const absoluteExpired = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: absoluteCookie } });
    expect(absoluteExpired.status()).toBe(401);
    expect((await absoluteExpired.json()).error.code).toBe("SESSION_REQUIRED");
  });
});
