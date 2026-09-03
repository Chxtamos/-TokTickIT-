import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

type TicketListItem = {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: string;
  currentStatus: string;
};

async function enterRequesterWorkspace(page: Page): Promise<number> {
  await page.goto("/");
  const requesterSelect = page.locator("#requester-select");
  await expect(requesterSelect).toBeVisible();
  await expect(requesterSelect.locator("option")).toHaveCount(5);
  await requesterSelect.selectOption({ index: 1 });
  const requesterId = Number(await requesterSelect.inputValue());
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to TokTickIT" })).toBeVisible();
  return requesterId;
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
});
