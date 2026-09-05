import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Alice Requester" };
const secondRequester = { id: 2, name: "Bob Requester" };
const ticket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery issue",
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "Corporate Laptop" },
  requestedPriority: "HIGH" as const,
  currentStatus: "NEW",
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
};

const response = (items = [ticket], overrides: Partial<api.TicketListResponse["pagination"]> = {}): api.TicketListResponse => ({
  items,
  pagination: { page: 1, pageSize: 10, totalItems: items.length, totalPages: items.length ? 1 : 0, hasPreviousPage: false, hasNextPage: false, ...overrides },
  applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" },
});

async function renderMyTickets(getTickets = vi.spyOn(api, "getTickets").mockResolvedValue(response())) {
  sessionStorage.setItem("toktickit.requesterId", "1");
  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
  render(<App />);
  await screen.findByText("Welcome to TokTickIT");
  fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
  await screen.findByRole("heading", { name: "My Tickets" });
  return getTickets;
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("My Tickets screen", () => {
  it("loads owner-scoped summaries in a semantic table", async () => {
    const getTickets = await renderMyTickets();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("TKT-2026-000042")).toBeInTheDocument();
    expect(within(table).getByText("Laptop battery issue")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Ticket Number" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "View Ticket" })).toBeEnabled();
    expect(within(table).getByRole("columnheader", { name: "Last Updated" })).toHaveAttribute("aria-sort", "descending");
    expect(document.querySelector(".tickets-cards .ticket-card")).toHaveTextContent("TKT-2026-000042");
    expect(document.querySelector(".tickets-cards .ticket-card")).toHaveTextContent("View Ticket");
    expect(getTickets).toHaveBeenCalledWith(1, expect.objectContaining({ page: 1, pageSize: 10, sortBy: "updatedAt", sortDirection: "desc" }));
  });

  it("clears requester A data and loads requester B data after a context switch", async () => {
    const bobTicket = { ...ticket, id: 84, ticketNumber: "TKT-2026-000084", summary: "Bob VPN issue" };
    const getRequesters = vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester, secondRequester]);
    const getTickets = vi.spyOn(api, "getTickets").mockImplementation(async (requesterId) => requesterId === 1 ? response() : response([bobTicket]));
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
    sessionStorage.setItem("toktickit.requesterId", "1");
    render(<App />);
    await screen.findByText("Requester: Alice Requester");
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    expect(within(await screen.findByRole("table")).getByText("TKT-2026-000042")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change Requester" }));
    fireEvent.change(await screen.findByLabelText("Development Requester"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Requester: Bob Requester")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    expect(within(await screen.findByRole("table")).getByText("TKT-2026-000084")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("TKT-2026-000042")).not.toBeInTheDocument();
    expect(getRequesters).toHaveBeenCalledTimes(2);
    expect(getTickets).toHaveBeenCalledWith(2, expect.objectContaining({ page: 1 }));
  });

  it("shows a labelled loading state without stale ticket rows", async () => {
    let resolveTickets!: (value: api.TicketListResponse) => void;
    const getTickets = vi.spyOn(api, "getTickets").mockImplementation(() => new Promise((resolve) => { resolveTickets = resolve; }));
    await renderMyTickets(getTickets);
    expect(screen.getByText("Loading Tickets…")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    resolveTickets(response());
    expect(within(await screen.findByRole("table")).getByText("TKT-2026-000042")).toBeInTheDocument();
  });

  it("updates search and filters, resets to page one, and supports clear", async () => {
    const getTickets = await renderMyTickets();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "VPN" } });
    fireEvent.change(screen.getByLabelText("Requested Priority"), { target: { value: "URGENT" } });
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "VPN", requestedPriority: "URGENT", page: 1 })));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "", requestedPriority: null, page: 1 })));
  });

  it("distinguishes owner-empty and filtered no-results states", async () => {
    const getTickets = vi.spyOn(api, "getTickets").mockResolvedValueOnce(response([], { totalItems: 0, totalPages: 0 }));
    await renderMyTickets(getTickets);
    expect(await screen.findByText("You have not created any tickets yet.")).toBeInTheDocument();
    cleanup();
    vi.restoreAllMocks();
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
    vi.spyOn(api, "getTickets").mockResolvedValue(response([], { totalItems: 3, totalPages: 1 }));
    render(<App />);
    await screen.findByText("Welcome to TokTickIT");
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    await screen.findByRole("heading", { name: "My Tickets" });
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "missing" } });
    expect(await screen.findByText("No tickets match the current search or filters.")).toBeInTheDocument();
  });

  it("shows safe failure and retries while preserving filters", async () => {
    const getTickets = vi.spyOn(api, "getTickets").mockRejectedValueOnce(new Error("Unable to load Tickets")).mockResolvedValueOnce(response());
    await renderMyTickets(getTickets);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Tickets");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(within(await screen.findByRole("table")).getByText("TKT-2026-000042")).toBeInTheDocument();
    expect(getTickets).toHaveBeenCalledTimes(2);
  });

  it("supports page size and next-page controls", async () => {
    const getTickets = vi.spyOn(api, "getTickets").mockResolvedValue(response([ticket], { totalItems: 21, totalPages: 3, hasNextPage: true }));
    await renderMyTickets(getTickets);
    fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "20" } });
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ pageSize: 20, page: 1 })));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ page: 2, pageSize: 20 })));
  });
});
