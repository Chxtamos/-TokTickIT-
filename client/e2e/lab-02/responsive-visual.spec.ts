import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";

type ReferenceItem = { id: number; name: string };
type Scenario = { requesterId: number; summary: string; ticketNumber: string; attachmentName: string };

function pdfFixture() {
  return Buffer.from("%PDF-1.4\nResponsive E2E fixture\n", "utf8");
}

async function getFirstActive<T extends ReferenceItem>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`${API_URL}${path}`);
  expect(response.ok()).toBeTruthy();
  const items = await response.json() as T[];
  expect(items.length).toBeGreaterThan(0);
  return items[0];
}

async function seedScenario(request: APIRequestContext): Promise<Scenario> {
  const requester = await getFirstActive<ReferenceItem>(request, "/api/development-requesters");
  const category = await getFirstActive<ReferenceItem>(request, "/api/categories");
  const relatedSystem = await getFirstActive<ReferenceItem>(request, "/api/related-systems");
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const summary = `Feature 21 responsive ticket ${runId}`;
  const createResponse = await request.post(`${API_URL}/api/tickets`, {
    headers: { "X-Requester-Id": String(requester.id), "Content-Type": "application/json" },
    data: {
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary,
      requestedPriority: "HIGH",
      description: "Responsive viewport verification for the Lab 2 requester workflow.",
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json() as { ticket: { id: number; ticketNumber: string } };
  const attachmentName = `responsive-${"long-filename-".repeat(13)}${runId}.pdf`;
  const uploadResponse = await request.post(`${API_URL}/api/tickets/${created.ticket.id}/attachments`, {
    headers: { "X-Requester-Id": String(requester.id) },
    multipart: { file: { name: attachmentName, mimeType: "application/pdf", buffer: pdfFixture() } },
  });
  expect(uploadResponse.status()).toBe(201);
  return { requesterId: requester.id, summary, ticketNumber: created.ticket.ticketNumber, attachmentName };
}

async function enterRequesterWorkspace(page: Page, requesterId: number) {
  await page.goto("/");
  const requesterSelect = page.locator("#requester-select");
  await expect(requesterSelect).toBeVisible();
  await requesterSelect.selectOption(String(requesterId));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to TokTickIT" })).toBeVisible();
}

async function assertNoPageOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(widths.documentScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth);
  expect(widths.bodyScrollWidth).toBeLessThanOrEqual(widths.documentClientWidth);
}

async function assertNoClippingOrOverlap(page: Page) {
  const layout = await page.locator("main").evaluate((main) => {
    const viewportWidth = document.documentElement.clientWidth;
    const children = Array.from(main.children)
      .filter((element) => getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden")
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { name: element.className || element.tagName, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
    const clipped = children.filter((box) => box.left < -1 || box.right > viewportWidth + 1).map((box) => box.name);
    const overlaps: string[] = [];
    for (let index = 0; index < children.length; index += 1) {
      for (let next = index + 1; next < children.length; next += 1) {
        const first = children[index];
        const second = children[next];
        if (Math.min(first.right, second.right) > Math.max(first.left, second.left) && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top)) {
          overlaps.push(`${first.name} overlaps ${second.name}`);
        }
      }
    }
    return { clipped, overlaps };
  });
  expect(layout.clipped).toEqual([]);
  expect(layout.overlaps).toEqual([]);
}

async function assertTouchTargets(page: Page, selector: string, minimum = 36) {
  const sizes = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.every((size) => size.width >= 44 && size.height >= minimum)).toBeTruthy();
}

async function assertWithinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function openMyTickets(page: Page, scenario: Scenario) {
  await page.getByRole("button", { name: "My Tickets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.locator("#ticket-search").fill(scenario.summary);
  await expect(page.locator(".result-count")).toHaveText("Showing 1 of 1 Tickets");
}

async function openDetail(page: Page, scenario: Scenario) {
  const ticketContainer = page.viewportSize()!.width < 768 ? ".tickets-cards .ticket-card" : ".tickets-table tbody tr";
  await page.locator(ticketContainer).filter({ hasText: scenario.summary }).getByRole("button", { name: "View Ticket", exact: true }).click();
  await expect(page.getByRole("heading", { name: scenario.ticketNumber, exact: true })).toBeVisible();
  await expect(page.getByText(scenario.attachmentName, { exact: true })).toBeVisible();
}

test.describe("Lab 2 responsive and visual viewport contract", () => {
  test("keeps the desktop table, Create Ticket form, and Detail within 1440x900", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const scenario = await seedScenario(request);
    await enterRequesterWorkspace(page, scenario.requesterId);

    await page.getByRole("button", { name: "Create Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await assertWithinViewport(page, page.locator(".ticket-form"));
    await assertNoClippingOrOverlap(page);
    await assertNoPageOverflow(page);
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(page.locator(".tickets-table")).toBeVisible();
    await expect(page.locator(".tickets-cards")).toBeHidden();
    await openMyTickets(page, scenario);
    await assertWithinViewport(page, page.locator(".tickets-table-wrap"));
    await openDetail(page, scenario);
    await assertWithinViewport(page, page.locator("#ticket-detail"));
    await assertWithinViewport(page, page.locator(".attachment-section"));
    await assertNoClippingOrOverlap(page);
    await assertNoPageOverflow(page);
  });

  test("keeps tablet controls, table, Detail, and long filenames usable at 820x1180", async ({ page, request }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    const scenario = await seedScenario(request);
    await enterRequesterWorkspace(page, scenario.requesterId);

    await page.getByRole("button", { name: "Create Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await assertWithinViewport(page, page.locator(".ticket-form"));
    await assertNoClippingOrOverlap(page);
    await expect(page.locator("#category-id")).toBeVisible();
    await expect(page.locator("#related-system-id")).toBeVisible();
    await assertNoPageOverflow(page);
    await openMyTickets(page, scenario);
    await expect(page.locator(".tickets-table")).toBeVisible();
    await assertWithinViewport(page, page.locator(".tickets-table-wrap"));
    await openDetail(page, scenario);
    await assertWithinViewport(page, page.locator(".attachment-section"));
    await assertNoClippingOrOverlap(page);
    await assertNoPageOverflow(page);
  });

  test("uses equivalent Ticket cards and keeps Detail actions readable at 390x844", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const scenario = await seedScenario(request);
    await enterRequesterWorkspace(page, scenario.requesterId);

    await page.getByRole("button", { name: "Create Ticket", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await assertWithinViewport(page, page.locator(".ticket-form"));
    await assertNoClippingOrOverlap(page);
    await assertNoPageOverflow(page);
    await openMyTickets(page, scenario);
    await expect(page.locator(".tickets-table-wrap")).toBeHidden();
    await expect(page.locator(".tickets-cards")).toBeVisible();
    const card = page.locator(".ticket-card").filter({ hasText: scenario.summary });
    await expect(card).toBeVisible();
    const tableRow = page.locator(".tickets-table tbody tr").filter({ hasText: scenario.summary });
    const tableCells = await tableRow.locator("td").allTextContents();
    const cardValues = await card.locator("dd").allTextContents();
    expect(await card.locator("h2").textContent()).toBe(tableCells[0]);
    expect(cardValues.slice(0, 5)).toEqual(tableCells.slice(1, 6));
    await expect(card.getByRole("button", { name: "View Ticket", exact: true })).toBeVisible();
    await assertWithinViewport(page, card);
    await assertWithinViewport(page, card.getByRole("button", { name: "View Ticket", exact: true }));
    await assertTouchTargets(page, ".tickets-cards .ticket-card button", 44);
    await assertNoClippingOrOverlap(page);
    await openDetail(page, scenario);
    await assertWithinViewport(page, page.locator("#ticket-detail"));
    const filename = page.getByText(scenario.attachmentName, { exact: true });
    await assertWithinViewport(page, filename);
    const filenameMetrics = await filename.evaluate((element) => {
      const style = getComputedStyle(element);
      return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowWrap: style.overflowWrap };
    });
    expect(filenameMetrics.scrollWidth).toBeLessThanOrEqual(filenameMetrics.clientWidth);
    expect(["anywhere", "break-word"]).toContain(filenameMetrics.overflowWrap);
    await expect(page.getByRole("button", { name: "Download", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
    await assertTouchTargets(page, ".attachment-actions button");
    await assertNoClippingOrOverlap(page);
    await assertNoPageOverflow(page);
  });
});
