import { expect, test, type APIRequestContext } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const INITIAL_PASSWORD = process.env.LAB_SEED_INITIAL_PASSWORD ?? "local-lab-only-seed-password-2026";

async function login(request: APIRequestContext, email: string, password: string) {
  return request.post(`${API_URL}/api/auth/login`, {
    headers: { Origin: "http://127.0.0.1:5173" },
    data: { email, password },
  });
}

test.describe("Lab 3 authentication", () => {
  test("covers invalid, inactive and valid mandatory login with logout replay denial", async ({ request }) => {
    const invalid = await login(request, "missing@example.test", "wrong password value");
    expect(invalid.status()).toBe(401);
    expect((await invalid.json()).error.code).toBe("INVALID_CREDENTIALS");

    const inactive = await login(request, "inactive.requester@example.test", INITIAL_PASSWORD);
    expect(inactive.status()).toBe(401);
    expect((await inactive.json()).error.code).toBe("INVALID_CREDENTIALS");

    const valid = await login(request, "anan.srisuk@example.test", INITIAL_PASSWORD);
    expect(valid.status()).toBe(200);
    const body = await valid.json();
    expect(body.user).toMatchObject({ role: "REQUESTER", mustChangePassword: true });
    expect(body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const cookie = valid.headers()["set-cookie"];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Max-Age=900");

    const me = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(me.status()).toBe(200);
    const logout = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Origin: "http://127.0.0.1:5173", Cookie: cookie, "X-CSRF-Token": body.csrfToken },
    });
    expect(logout.status()).toBe(204);
    const replay = await request.get(`${API_URL}/api/auth/me`, { headers: { Cookie: cookie } });
    expect(replay.status()).toBe(401);
  });
});
