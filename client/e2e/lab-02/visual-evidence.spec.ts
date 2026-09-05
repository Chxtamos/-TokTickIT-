import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const SCREENSHOT_ROOT = path.resolve(process.cwd(), "..", "artifacts/lab-02/screenshots");

type Item = { id: number; name: string };
type Scenario = { requesterId: number; otherRequesterId: number; ticketId: number; ticketNumber: string; summary: string; attachmentName: string };

function pdfFixture() {
  return Buffer.from("%PDF-1.4\nVisual evidence fixture\n", "utf8");
}

async function firstItem(request: APIRequestContext, endpoint: string): Promise<Item> {
  const response = await request.get(`${API_URL}${endpoint}`);
  expect(response.ok()).toBeTruthy();
  const items = await response.json() as Item[];
  expect(items.length).toBeGreaterThan(0);
  return items[0];
}

async function createScenario(request: APIRequestContext): Promise<Scenario> {
  const requestersResponse = await request.get(`${API_URL}/api/development-requesters`);
  expect(requestersResponse.ok()).toBeTruthy();
  const requesters = await requestersResponse.json() as Item[];
  expect(requesters.length).toBeGreaterThanOrEqual(2);
  const category = await firstItem(request, "/api/categories");
  const relatedSystem = await firstItem(request, "/api/related-systems");
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const summary = `Feature 22 visual evidence ${runId}`;
  const createResponse = await request.post(`${API_URL}/api/tickets`, {
    headers: { "X-Requester-Id": String(requesters[0].id), "Content-Type": "application/json" },
    data: {
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary,
      requestedPriority: "HIGH",
      description: "Visual evidence for the Lab 2 requester workflow.",
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json() as { ticket: { id: number; ticketNumber: string } };
  const attachmentName = `visual-evidence-${runId}.pdf`;
  const uploadResponse = await request.post(`${API_URL}/api/tickets/${created.ticket.id}/attachments`, {
    headers: { "X-Requester-Id": String(requesters[0].id) },
    multipart: { file: { name: attachmentName, mimeType: "application/pdf", buffer: pdfFixture() } },
  });
  expect(uploadResponse.status()).toBe(201);
  return { requesterId: requesters[0].id, otherRequesterId: requesters[1].id, ticketId: created.ticket.id, ticketNumber: created.ticket.ticketNumber, summary, attachmentName };
}

async function capture(page: Page, folder: string, name: string) {
  const directory = path.join(SCREENSHOT_ROOT, folder);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

async function enterRequester(page: Page, requesterId: number) {
  await page.goto("/");
  const requesterSelect = page.locator("#requester-select");
  if (await requesterSelect.count() === 0) {
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
  }
  await expect(requesterSelect).toBeVisible();
  await requesterSelect.selectOption(String(requesterId));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to TokTickIT" })).toBeVisible();
}

async function fillTicket(page: Page, summary: string) {
  await page.locator("#category-id").selectOption({ index: 1 });
  await page.locator("#related-system-id").selectOption({ index: 1 });
  await page.locator("#requested-priority").selectOption("HIGH");
  await page.locator("#summary").fill(summary);
  await page.locator("#description").fill("Visual evidence for the Lab 2 requester workflow.");
}

async function openDetail(page: Page, scenario: Scenario) {
  await page.getByRole("button", { name: "My Tickets", exact: true }).click();
  await page.locator("#ticket-search").fill(scenario.summary);
  await expect(page.locator(".result-count")).toHaveText("Showing 1 of 1 Tickets");
  const container = page.viewportSize()!.width < 768 ? ".tickets-cards .ticket-card" : ".tickets-table tbody tr";
  await page.locator(container).filter({ hasText: scenario.summary }).getByRole("button", { name: "View Ticket", exact: true }).click();
  await expect(page.getByRole("heading", { name: scenario.ticketNumber, exact: true })).toBeVisible();
}

async function clearRequester(page: Page) {
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/");
}

test.describe("Lab 2 screenshot evidence", () => {
  test("captures the approved visual states and viewport evidence", async ({ page, request }) => {
    test.setTimeout(120_000);
    const scenario = await createScenario(request);
    const requestersResponse = await request.get(`${API_URL}/api/development-requesters`);
    const requesters = await requestersResponse.json() as Item[];

    // Requester selector: ready, loading, and failure.
    await page.goto("/");
    await expect(page.locator("#requester-select")).toBeVisible();
    await capture(page, "requester-selection", "ready");
    let releaseLoading!: () => void;
    const loadingGate = new Promise<void>((resolve) => { releaseLoading = resolve; });
    await page.route("**/api/development-requesters", async (route) => { await loadingGate; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(requesters) }); });
    await page.reload();
    await expect(page.getByText("Loading Requesters…", { exact: true })).toBeVisible();
    await capture(page, "requester-selection", "loading");
    releaseLoading();
    await expect(page.locator("#requester-select")).toBeVisible();
    await page.unroute("**/api/development-requesters");
    await page.route("**/api/development-requesters", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "REFERENCE_DATA_UNAVAILABLE" }) }));
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Unable to load Development Requesters");
    await capture(page, "requester-selection", "failure");
    await page.unroute("**/api/development-requesters");

    // Create Ticket: initial, validation, submitting, API failure, success, and invalid file.
    await enterRequester(page, scenario.requesterId);
    await page.locator("nav").getByRole("button", { name: "Create Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await capture(page, "create-ticket", "initial-desktop");
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.locator(".field-error").first()).toBeVisible();
    await capture(page, "create-ticket", "validation");
    await page.locator("#attachments").setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
    await expect(page.getByText("Unsupported file type", { exact: false })).toBeVisible();
    await capture(page, "create-ticket", "invalid-attachment");
    await fillTicket(page, `Feature 22 API failure ${Date.now()}`);
    let releaseSubmit!: () => void;
    const submitGate = new Promise<void>((resolve) => { releaseSubmit = resolve; });
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await submitGate;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "CREATE_TICKET_UNAVAILABLE", message: "Unable to create Ticket" } }) });
    });
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("button", { name: "Submitting…", exact: true })).toBeDisabled();
    await capture(page, "create-ticket", "submitting");
    releaseSubmit();
    await expect(page.getByRole("alert")).toContainText("Unable to create Ticket");
    await capture(page, "create-ticket", "api-failure");
    await page.unroute("**/api/tickets");
    await fillTicket(page, `Feature 22 success ${Date.now()}`);
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ticket created" })).toBeVisible();
    await capture(page, "create-ticket", "success");

    // My Tickets: A/B, search/filter/sort/page, empty, no-results, and failure.
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.locator(".result-count")).toBeVisible();
    await capture(page, "my-tickets", "requester-a-desktop");
    await page.locator("#ticket-search").fill(scenario.summary);
    await page.locator("#ticket-priority").selectOption("HIGH");
    await page.locator("#ticket-sort").selectOption("ticketNumber");
    await page.locator("#ticket-direction").selectOption("asc");
    await capture(page, "my-tickets", "search-filter-sort-page");
    await page.route("**/api/tickets*", (route) => route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false }, applied: { search: "no-ticket-matches-this-value", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } }) }) : route.continue());
    await page.locator("#ticket-search").fill("no-ticket-matches-this-value");
    await expect(page.getByText("No tickets match the current search or filters", { exact: false })).toBeVisible();
    await capture(page, "my-tickets", "no-results");
    await page.unroute("**/api/tickets*");
    await page.locator("form.ticket-filters").getByRole("button", { name: "Clear Filters", exact: true }).click();
    await page.route("**/api/tickets*", (route) => route.request().method() === "GET" ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "TICKET_LIST_FAILED", message: "Unable to load Tickets." } }) }) : route.continue());
    await page.locator("nav").getByRole("button", { name: "Create Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Unable to load Tickets");
    await capture(page, "my-tickets", "failure");
    await page.unroute("**/api/tickets*");
    await page.getByRole("button", { name: "Change Requester", exact: true }).click();
    await page.locator("#requester-select").selectOption(String(scenario.otherRequesterId));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.locator(".result-count")).toBeVisible();
    await capture(page, "my-tickets", "requester-b-desktop");

    // A requester with a mocked empty response documents the empty state without changing production data.
    await clearRequester(page);
    await enterRequester(page, scenario.requesterId);
    await page.route("**/api/tickets*", (route) => route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } }) }) : route.continue());
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.getByText("You have not created any tickets yet", { exact: false })).toBeVisible();
    await capture(page, "my-tickets", "empty");
    await page.unroute("**/api/tickets*");

    // Ticket Detail: owned view, upload/download controls, removal dialog, removed metadata, and blocked actions.
    await clearRequester(page);
    await enterRequester(page, scenario.requesterId);
    await openDetail(page, scenario);
    await capture(page, "ticket-detail", "owned-upload-download");
    await page.locator("#detail-attachments").setInputFiles({ name: "pending-visual.pdf", mimeType: "application/pdf", buffer: pdfFixture() });
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeVisible();
    await capture(page, "ticket-detail", "upload-pending");
    await page.locator(".attachment-metadata-list").getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(page, "ticket-detail", "removal-dialog");
    await page.getByLabel("Reason").fill("Visual evidence cleanup");
    await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
    await expect(page.getByText("Removed · Visual evidence cleanup", { exact: true })).toBeVisible();
    await expect(page.getByText("Removed at", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
    await capture(page, "ticket-detail", "removed-metadata-blocked-actions");

    // Unauthorized result: B can see only its own list, while an attempted A detail resolves safely.
    await clearRequester(page);
    await enterRequester(page, scenario.otherRequesterId);
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await page.route("**/api/tickets/*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch({ url: `${API_URL}/api/tickets/${scenario.ticketId}`, headers: { ...route.request().headers(), "x-requester-id": String(scenario.otherRequesterId) } });
      expect(response.status()).toBe(404);
      return route.fulfill({ response });
    });
    // Navigate to a real B-owned row to exercise the safe Detail error state; the rewritten request uses B's header and A's ID.
    const requesterBRow = page.locator(".tickets-table tbody tr").first();
    await expect(requesterBRow).toBeVisible();
    await requesterBRow.getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Ticket not found or unavailable");
    await capture(page, "ticket-detail", "unauthorized-not-found");
    await page.unroute("**/api/tickets/*");

    // Required viewport captures for Create Ticket, My Tickets, and Ticket Detail.
    for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "tablet", width: 820, height: 1180 }, { name: "mobile", width: 390, height: 844 }]) {
      const viewportScenario = await createScenario(request);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await clearRequester(page);
      await enterRequester(page, viewportScenario.requesterId);
      await page.getByRole("button", { name: "Create Ticket", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
      await capture(page, "create-ticket", `${viewport.name}`);
      await openDetail(page, viewportScenario);
      await capture(page, "ticket-detail", `${viewport.name}`);
      await page.getByRole("button", { name: "Back to My Tickets", exact: false }).click();
      await capture(page, "my-tickets", `${viewport.name}`);
    }
  });
});
