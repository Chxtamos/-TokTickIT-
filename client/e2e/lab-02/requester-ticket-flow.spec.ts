import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

type TicketListItem = {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  currentStatus: string;
};

type ReferenceItem = { id: number; name: string };
type Requester = ReferenceItem;

async function enterRequesterWorkspace(page: Page, requestedRequesterId?: number): Promise<number> {
  await page.goto("/");
  const requesterSelect = page.locator("#requester-select");
  await expect(requesterSelect).toBeVisible();
  const activeRequesterOption = requesterSelect.locator('option:not([value=""])').first();
  await expect(activeRequesterOption).toHaveCount(1);
  const requesterId = requestedRequesterId ?? Number(await activeRequesterOption.getAttribute("value"));
  expect(Number.isSafeInteger(requesterId)).toBeTruthy();
  await requesterSelect.selectOption(String(requesterId));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to TokTickIT" })).toBeVisible();
  return requesterId;
}

async function getActiveRequesters(request: APIRequestContext): Promise<Requester[]> {
  const response = await request.get(`${API_URL}/api/development-requesters`);
  expect(response.ok()).toBeTruthy();
  return await response.json() as Requester[];
}

async function getReferenceData(request: APIRequestContext): Promise<{ category: ReferenceItem; relatedSystem: ReferenceItem }> {
  const [categoriesResponse, systemsResponse] = await Promise.all([
    request.get(`${API_URL}/api/categories`),
    request.get(`${API_URL}/api/related-systems`),
  ]);
  expect(categoriesResponse.ok()).toBeTruthy();
  expect(systemsResponse.ok()).toBeTruthy();
  const categories = await categoriesResponse.json() as ReferenceItem[];
  const relatedSystems = await systemsResponse.json() as ReferenceItem[];
  expect(categories.length).toBeGreaterThan(0);
  expect(relatedSystems.length).toBeGreaterThan(0);
  return { category: categories[0], relatedSystem: relatedSystems[0] };
}

async function createTicketForRequester(
  request: APIRequestContext,
  requesterId: number,
  summary: string,
  references: { category: ReferenceItem; relatedSystem: ReferenceItem },
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "HIGH",
): Promise<TicketListItem> {
  const response = await request.post(`${API_URL}/api/tickets`, {
    headers: { "X-Requester-Id": String(requesterId), "Content-Type": "application/json" },
    data: {
      clientRequestId: randomUUID(),
      categoryId: references.category.id,
      relatedSystemId: references.relatedSystem.id,
      summary,
      requestedPriority,
      description: "Feature 19 end-to-end ownership verification.",
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json() as { ticket: TicketListItem };
  return body.ticket;
}

async function openCreateTicket(page: Page) {
  await page.getByRole("button", { name: "Create Ticket", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.locator("#category-id")).toBeEnabled();
  await expect(page.locator("#related-system-id")).toBeEnabled();
}

async function fillValidTicket(page: Page, summary: string) {
  await page.locator("#category-id").selectOption({ index: 1 });
  await page.locator("#related-system-id").selectOption({ index: 1 });
  await page.locator("#requested-priority").selectOption("URGENT");
  await page.locator("#summary").fill(summary);
  await page.locator("#description").fill("End-to-end verification of the complete requester ticket workflow.");
}

async function findTicket(request: APIRequestContext, requesterId: number, summary: string): Promise<TicketListItem> {
  const response = await request.get(`${API_URL}/api/tickets?search=${encodeURIComponent(summary)}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { items: TicketListItem[] };
  const matches = body.items.filter((item) => item.summary === summary);
  expect(matches).toHaveLength(1);
  return matches[0];
}

function pdfFixture() {
  return Buffer.from("%PDF-1.4\nE2E fixture\n", "utf8");
}

function pngFixture() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

test.describe("Lab 2 requester-to-Ticket workflow", () => {
  test("creates a Ticket with mixed Attachments and verifies authoritative backend values", async ({ page, request }) => {
    const requesterId = await enterRequesterWorkspace(page);
    await openCreateTicket(page);

    const summary = `E2E mixed attachments ${Date.now()}`;
    await fillValidTicket(page, summary);
    await page.locator("#attachments").setInputFiles([
      { name: "e2e-mixed.pdf", mimeType: "application/pdf", buffer: pdfFixture() },
      { name: "e2e-mixed.png", mimeType: "image/png", buffer: pngFixture() },
    ]);
    await expect(page.getByText("e2e-mixed.pdf", { exact: false })).toBeVisible();
    await expect(page.getByText("e2e-mixed.png", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ticket created" })).toBeVisible();
    const ticketNumber = await page.locator(".alert-success strong").textContent();
    expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    await expect(page.getByText("e2e-mixed.pdf: Uploaded", { exact: true })).toBeVisible();
    await expect(page.getByText("e2e-mixed.png: Uploaded", { exact: true })).toBeVisible();

    const ticket = await findTicket(request, requesterId, summary);
    expect(ticket.ticketNumber).toBe(ticketNumber);
    expect(ticket.requestedPriority).toBe("URGENT");
    expect(ticket.currentStatus).toBe("NEW");

    const detailResponse = await request.get(`${API_URL}/api/tickets/${ticket.id}`, {
      headers: { "X-Requester-Id": String(requesterId) },
    });
    expect(detailResponse.ok()).toBeTruthy();
    const detail = await detailResponse.json() as { attachments: Array<{ originalName: string; state: string }> };
    expect(detail.attachments.map((attachment) => attachment.originalName).sort()).toEqual(["e2e-mixed.pdf", "e2e-mixed.png"]);
    expect(detail.attachments.every((attachment) => attachment.state === "ACTIVE")).toBeTruthy();
  });

  test("reuses the logical submission after an ambiguous create failure and retries one failed Attachment", async ({ page, request }) => {
    const requesterId = await enterRequesterWorkspace(page);
    await openCreateTicket(page);

    const summary = `E2E retry recovery ${Date.now()}`;
    await fillValidTicket(page, summary);
    await page.locator("#attachments").setInputFiles([
      { name: "e2e-retry.pdf", mimeType: "application/pdf", buffer: pdfFixture() },
      { name: "e2e-retry.png", mimeType: "image/png", buffer: pngFixture() },
    ]);

    let createCalls = 0;
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      createCalls += 1;
      const response = await route.fetch();
      if (createCalls === 1) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "CREATE_TICKET_UNAVAILABLE", message: "Unable to create Ticket" } }),
        });
      }
      return route.fulfill({ response });
    });

    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Unable to create Ticket");
    await expect(page.locator("#summary")).toHaveValue(summary);
    await expect(page.getByText("e2e-retry.pdf", { exact: false })).toBeVisible();

    let attachmentCalls = 0;
    await page.route("**/api/tickets/*/attachments", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attachmentCalls += 1;
      if (attachmentCalls === 1) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "ATTACHMENT_UPLOAD_FAILED", message: "Simulated Attachment failure." } }),
        });
      }
      return route.continue();
    });

    await page.getByRole("alert").getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("button", { name: "Submit Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ticket created" })).toBeVisible();
    await expect(page.getByText("e2e-retry.pdf: Simulated Attachment failure.", { exact: false })).toBeVisible();
    await expect(page.getByText("e2e-retry.png: Uploaded", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("e2e-retry.pdf: Uploaded", { exact: false })).toBeVisible();

    const ticket = await findTicket(request, requesterId, summary);
    expect(createCalls).toBe(2);
    expect(attachmentCalls).toBe(3);
    const detailResponse = await request.get(`${API_URL}/api/tickets/${ticket.id}`, {
      headers: { "X-Requester-Id": String(requesterId) },
    });
    expect(detailResponse.ok()).toBeTruthy();
    const detail = await detailResponse.json() as { attachments: Array<{ originalName: string; state: string }> };
    expect(detail.attachments).toHaveLength(2);
    expect(detail.attachments.every((attachment) => attachment.state === "ACTIVE")).toBeTruthy();
  });

  test("isolates Requester A and B, exercises My Tickets controls, and preserves the query after owned Detail", async ({ page, request }) => {
    const requesters = await getActiveRequesters(request);
    expect(requesters.length).toBeGreaterThanOrEqual(2);
    const [requesterA, requesterB] = requesters;
    const references = await getReferenceData(request);
    const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const targetSummary = `Feature 19 A target ${runId}`;
    const ticketSummaries = [targetSummary, ...Array.from({ length: 10 }, (_, index) => `Feature 19 A pagination ${runId}-${index}`)];
    const createdTickets = await Promise.all(ticketSummaries.map((summary, index) => createTicketForRequester(
      request,
      requesterA.id,
      summary,
      references,
      index === 0 ? "HIGH" : "MEDIUM",
    )));
    const bSummary = `Feature 19 B private ${runId}`;
    await createTicketForRequester(request, requesterB.id, bSummary, references, "HIGH");

    await enterRequesterWorkspace(page, requesterA.id);
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.locator(".result-count")).toContainText("Tickets");
    await expect(page.getByText(bSummary, { exact: true })).toHaveCount(0);

    // Verify real pagination, page-size selection, and page reset behavior.
    await page.locator("#ticket-page-size").selectOption("10");
    await expect(page.locator(".pagination")).toContainText("Page 1 of");
    await page.getByRole("navigation", { name: "Ticket pagination" }).getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".pagination")).toContainText("Page 2 of");
    await page.locator("#ticket-page-size").selectOption("20");
    await expect(page.locator(".pagination")).toContainText("Page 1 of");

    // Apply search, AND filters, sort, and direction through the real API.
    await page.locator("#ticket-search").fill(targetSummary);
    await expect(page.locator(".result-count")).toHaveText("Showing 1 of 1 Tickets");
    await page.locator("#ticket-category").selectOption(String(references.category.id));
    await page.locator("#ticket-system").selectOption(String(references.relatedSystem.id));
    await page.locator("#ticket-priority").selectOption("HIGH");
    await page.locator("#ticket-status").selectOption("NEW");
    await page.locator("#ticket-sort").selectOption("ticketNumber");
    await page.locator("#ticket-direction").selectOption("asc");
    await expect(page.locator(".result-count")).toHaveText("Showing 1 of 1 Tickets");
    await expect(page.locator(".tickets-table tbody").getByText(targetSummary, { exact: true })).toBeVisible();

    const targetTicket = createdTickets[0];
    await page.locator(".tickets-table tbody tr").filter({ hasText: targetSummary }).getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ticket Information" })).toBeVisible();
    await expect(page.getByText(targetSummary, { exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: targetTicket.ticketNumber, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Back to My Tickets", exact: false }).click();
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await expect(page.locator("#ticket-search")).toHaveValue(targetSummary);
    await expect(page.locator("#ticket-category")).toHaveValue(String(references.category.id));
    await expect(page.locator("#ticket-system")).toHaveValue(String(references.relatedSystem.id));
    await expect(page.locator("#ticket-priority")).toHaveValue("HIGH");
    await expect(page.locator("#ticket-status")).toHaveValue("NEW");
    await expect(page.locator("#ticket-sort")).toHaveValue("ticketNumber");
    await expect(page.locator("#ticket-direction")).toHaveValue("asc");
    await expect(page.locator("#ticket-page-size")).toHaveValue("20");
    await expect(page.locator(".tickets-table tbody").getByText(targetSummary, { exact: true })).toBeVisible();

    // Switch the active context through the real selector and prove A's state is gone before B loads.
    await page.getByRole("button", { name: "Change Requester", exact: true }).click();
    await expect(page.locator("#requester-select")).toBeVisible();
    await page.locator("#requester-select").selectOption(String(requesterB.id));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome to TokTickIT" })).toBeVisible();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.locator(".tickets-table tbody").getByText(bSummary, { exact: true })).toBeVisible();
    await expect(page.getByText(targetSummary, { exact: true })).toHaveCount(0);
  });

  test("rejects cross-owner and missing Ticket Detail safely", async ({ page, request }) => {
    const requesters = await getActiveRequesters(request);
    expect(requesters.length).toBeGreaterThanOrEqual(2);
    const [requesterA, requesterB] = requesters;
    const references = await getReferenceData(request);
    const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const aSummary = `Feature 19 A protected ${runId}`;
    const aTicket = await createTicketForRequester(request, requesterA.id, aSummary, references, "HIGH");
    const bSummary = `Feature 19 B detail ${runId}`;
    const bTicket = await createTicketForRequester(request, requesterB.id, bSummary, references, "HIGH");

    const crossOwnerResponse = await request.get(`${API_URL}/api/tickets/${aTicket.id}`, {
      headers: { "X-Requester-Id": String(requesterB.id) },
    });
    expect(crossOwnerResponse.status()).toBe(404);
    const crossOwnerBody = await crossOwnerResponse.json() as { error: { code: string; message: string } };
    expect(crossOwnerBody.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(JSON.stringify(crossOwnerBody)).not.toContain(aSummary);
    expect(JSON.stringify(crossOwnerBody)).not.toContain(aTicket.ticketNumber);

    const missingResponse = await request.get(`${API_URL}/api/tickets/999999999`, {
      headers: { "X-Requester-Id": String(requesterB.id) },
    });
    expect(missingResponse.status()).toBe(404);
    const missingBody = await missingResponse.json() as { error: { code: string } };
    expect(missingBody.error.code).toBe("RESOURCE_NOT_FOUND");

    await enterRequesterWorkspace(page, requesterB.id);
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.locator(".tickets-table tbody").getByText(bSummary, { exact: true })).toBeVisible();
    await page.route("**/api/tickets/*", async (route) => {
      if (route.request().method() === "GET" && route.request().url().endsWith(`/api/tickets/${bTicket.id}`)) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "RESOURCE_NOT_FOUND", message: "Ticket not found." } }),
        });
      }
      return route.continue();
    });
    await page.locator(".tickets-table tbody tr").filter({ hasText: bSummary }).getByRole("button", { name: "View Ticket", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Ticket not found or unavailable.");
    await expect(page.getByRole("heading", { name: "Ticket Information" })).toHaveCount(0);
    await expect(page.getByText(aSummary, { exact: true })).toHaveCount(0);
  });
});
