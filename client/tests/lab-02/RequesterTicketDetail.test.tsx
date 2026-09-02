import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Alice Requester" };
const ticket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  ticketDate: "2026-08-31T10:00:00.000Z",
  requester: { id: 1, name: "Alice Requester", email: "alice@example.com" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "Corporate Laptop" },
  summary: "Laptop battery issue",
  requestedPriority: "HIGH" as const,
  description: "Battery drains quickly\nOccurs during normal use.",
  currentStatus: "NEW",
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:30:00.000Z",
  attachments: [
    { id: 10, originalName: "battery.pdf", mimeType: "application/pdf", sizeBytes: 2048, state: "ACTIVE" as const, uploadedAt: "2026-08-31T10:05:00.000Z", removedAt: null, removedReason: null, downloadUrl: "/api/tickets/42/attachments/10/download" },
    { id: 11, originalName: "old-photo.jpg", mimeType: "image/jpeg", sizeBytes: 4096, state: "REMOVED" as const, uploadedAt: "2026-08-31T10:06:00.000Z", removedAt: "2026-08-31T10:20:00.000Z", removedReason: "Duplicate file", downloadUrl: null },
  ],
};

const listResponse: api.TicketListResponse = {
  items: [{ id: 42, ticketNumber: ticket.ticketNumber, summary: ticket.summary, category: ticket.category, relatedSystem: ticket.relatedSystem, requestedPriority: ticket.requestedPriority, currentStatus: ticket.currentStatus, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt }],
  pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
  applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" },
};

async function renderDetail(getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket), waitForScreen = true, getTickets = vi.spyOn(api, "getTickets").mockResolvedValue(listResponse)) {
  sessionStorage.setItem("toktickit.requesterId", "1");
  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue([ticket.category]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([ticket.relatedSystem]);
  render(<App />);
  await screen.findByText("Requester: Alice Requester");
  fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
  await screen.findByRole("table");
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "View Ticket" }));
  if (waitForScreen) await screen.findByRole("heading", { name: ticket.ticketNumber });
  return getDetail;
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Requester Ticket Detail screen", () => {
  it("loads owned read-only fields and active/removed Attachment metadata", async () => {
    const getDetail = await renderDetail();
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    expect(screen.getByText("Laptop battery issue")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Battery drains quickly") && content.includes("Occurs during normal use."))).toBeInTheDocument();
    expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
    expect(screen.getByText("battery.pdf")).toBeInTheDocument();
    expect(screen.getByText("old-photo.jpg")).toBeInTheDocument();
    expect(screen.getByText(/Duplicate file/)).toBeInTheDocument();
    expect(screen.getByText("Removed · Duplicate file")).toBeInTheDocument();
    expect(screen.getByText(/Removed at/)).toBeInTheDocument();
    const removedRow = screen.getByText("old-photo.jpg").closest("li");
    expect(removedRow).not.toBeNull();
    expect(within(removedRow as HTMLElement).queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(getDetail).toHaveBeenCalledWith(1, 42);
  });

  it("shows labelled loading state without stale detail", async () => {
    let resolveDetail!: (value: api.TicketDetail) => void;
    const getDetail = vi.spyOn(api, "getTicketDetail").mockImplementation(() => new Promise((resolve) => { resolveDetail = resolve; }));
    sessionStorage.setItem("toktickit.requesterId", "1");
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
    vi.spyOn(api, "getCategories").mockResolvedValue([ticket.category]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([ticket.relatedSystem]);
    vi.spyOn(api, "getTickets").mockResolvedValue(listResponse);
    render(<App />);
    await screen.findByText("Requester: Alice Requester");
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    await screen.findByRole("table");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "View Ticket" }));
    expect(screen.getByText("Loading Ticket Detail…")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Laptop battery issue")).not.toBeInTheDocument();
    resolveDetail(ticket);
    expect(await screen.findByText("Laptop battery issue")).toBeInTheDocument();
    expect(getDetail).toHaveBeenCalledWith(1, 42);
  });

  it("shows a safe failure and retries the same owned Ticket", async () => {
    const getDetail = vi.spyOn(api, "getTicketDetail").mockRejectedValueOnce(new Error("Unable to load Ticket Detail")).mockResolvedValueOnce(ticket);
    await renderDetail(getDetail, false);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Ticket Detail");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: ticket.ticketNumber })).toBeInTheDocument();
    expect(getDetail).toHaveBeenCalledTimes(2);
  });

  it("shows a safe not-found state for a missing or non-owned Ticket", async () => {
    const notFound = Object.assign(new Error("Ticket not found."), { statusCode: 404 });
    const getDetail = vi.spyOn(api, "getTicketDetail").mockRejectedValue(notFound);
    await renderDetail(getDetail, false);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found or unavailable.");
    expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument();
    expect(screen.queryByText(ticket.summary)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("returns to My Tickets with the previous list query preserved", async () => {
    const getTickets = vi.spyOn(api, "getTickets").mockImplementation(async (_requesterId, query) => ({
      ...listResponse,
      pagination: { ...listResponse.pagination, page: query.page, pageSize: query.pageSize },
      applied: { ...listResponse.applied, search: query.search, requestedPriority: query.requestedPriority },
    }));
    await renderDetail(undefined, true, getTickets);
    fireEvent.click(screen.getByRole("button", { name: "← Back to My Tickets" }));
    await screen.findByRole("heading", { name: "My Tickets" });
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "battery" } });
    fireEvent.change(screen.getByLabelText("Requested Priority"), { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "20" } });
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "battery", requestedPriority: "HIGH", page: 1, pageSize: 20 })));
    fireEvent.click(within(await screen.findByRole("table")).getByRole("button", { name: "View Ticket" }));
    await screen.findByRole("heading", { name: ticket.ticketNumber });
    fireEvent.click(screen.getByRole("button", { name: "← Back to My Tickets" }));
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(screen.getByLabelText("Search")).toHaveValue("battery");
    expect(screen.getByLabelText("Requested Priority")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Page size")).toHaveValue("20");
    expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "battery", requestedPriority: "HIGH", page: 1, pageSize: 20 }));
    expect(within(await screen.findByRole("table")).getByText(ticket.ticketNumber)).toBeInTheDocument();
  });
});
