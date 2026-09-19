import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { csrfToken, setRoute } from "../auth-fixtures.js";

const staff: api.AuthUser = { id: 10, name: "Support One", email: "support.one@example.test", role: "IT_STAFF", mustChangePassword: false };
const admin: api.AuthUser = { id: 20, name: "Admin User", email: "admin@example.test", role: "ADMINISTRATOR", mustChangePassword: false };
const category = { id: 2, name: "Access" };
const system = { id: 7, name: "Email" };
const owner: api.EligibleOwner = { id: 11, name: "Support Two", email: "support.two@example.test", role: "IT_STAFF" };
const ticket: api.StaffTicketSummary = {
  id: 59,
  ticketNumber: "TKT-2026-000059",
  summary: "Cannot access shared mailbox",
  category,
  relatedSystem: system,
  requestedPriority: "HIGH",
  itPriority: "URGENT",
  currentStatus: "IN_PROGRESS",
  version: 3,
  ticketOwner: owner,
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-18T09:00:00.000Z",
  requester: { id: 1, name: "Alice Requester", email: "alice@example.test", role: "REQUESTER" },
};
const defaults: api.StaffQueueQuery = { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, itPriority: null, currentStatus: null, owner: "all", sortBy: "updatedAt", sortDirection: "desc", page: 1, pageSize: 10 };

function response(overrides: Partial<api.StaffTicketListResponse> = {}): api.StaffTicketListResponse {
  return {
    items: [ticket],
    pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, itPriority: null, currentStatus: null, owner: "all", sortBy: "updatedAt", sortDirection: "desc" },
    ...overrides,
  };
}

function mockReferences() {
  vi.spyOn(api, "getCategories").mockResolvedValue([category]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([system]);
  vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValue([owner]);
}

async function renderQueue(user: api.AuthUser = staff, queue = vi.spyOn(api, "getStaffTickets").mockResolvedValue(response())) {
  setRoute("/staff/tickets");
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user, csrfToken });
  mockReferences();
  render(<App />);
  await screen.findByRole("heading", { name: "Ticket Queue" });
  return queue;
}

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); sessionStorage.clear(); setRoute(); });

describe("UI-05 Staff Ticket Queue", () => {
  it("loads documented defaults and resets page for every control change", async () => {
    const queue = vi.spyOn(api, "getStaffTickets").mockImplementation(async (query) => response({ pagination: { page: query.page, pageSize: query.pageSize, totalItems: 20, totalPages: 2, hasPreviousPage: query.page > 1, hasNextPage: query.page < 2 } }));
    await renderQueue(staff, queue);
    await waitFor(() => expect(queue).toHaveBeenCalledWith(defaults));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "2" } });
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 2, page: 1 })));
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "URGENT" } });
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "mine" } });
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "itPriority" } });
    fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "asc" } });
    fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "20" } });
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ itPriority: "URGENT", owner: "mine", sortBy: "itPriority", sortDirection: "asc", page: 1, pageSize: 20 })));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(defaults));
    expect(api.getCategories).toHaveBeenCalledTimes(1);
    expect(api.getRelatedSystems).toHaveBeenCalledTimes(1);
    expect(api.getEligibleTicketOwners).toHaveBeenCalledTimes(1);
  });

  it("renders desktop/card content, text badges, assigned and unassigned owners, and Open", async () => {
    const unassigned = { ...ticket, id: 60, ticketNumber: "TKT-2026-000060", ticketOwner: null, currentStatus: "NEW" as const, itPriority: "LOW" as const };
    await renderQueue(staff, vi.spyOn(api, "getStaffTickets").mockResolvedValue(response({ items: [ticket, unassigned], pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false } })));
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText(/Requester: Alice Requester/)[0]).toBeInTheDocument();
    expect(within(table).getAllByText("URGENT")[0]).toHaveClass("queue-badge");
    expect(within(table).getAllByText("IN PROGRESS")[0]).toHaveClass("queue-badge");
    expect(within(table).getByText("Support Two")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByLabelText("Shared Ticket Queue cards")).toHaveTextContent("Unassigned");
    expect(screen.getAllByRole("button", { name: "Open TKT-2026-000059" })[0]).toBeInTheDocument();
  });

  it("shows loading without stale queue content", async () => {
    let resolveQueue!: (value: api.StaffTicketListResponse) => void;
    const queue = vi.spyOn(api, "getStaffTickets").mockImplementation(() => new Promise((resolve) => { resolveQueue = resolve; }));
    await renderQueue(staff, queue);
    expect(screen.getByText("Loading Ticket Queue…")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(ticket.ticketNumber)).not.toBeInTheDocument();
    resolveQueue(response());
    expect(await screen.findAllByText(ticket.ticketNumber)).not.toHaveLength(0);
  });

  it("distinguishes a truly empty Queue from filter no-results", async () => {
    const empty = response({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
    const queue = vi.spyOn(api, "getStaffTickets").mockResolvedValue(empty);
    await renderQueue(staff, queue);
    expect(await screen.findByText(/shared Ticket Queue is empty/)).toBeInTheDocument();
    const emptyPagination = screen.getByRole("navigation", { name: "Ticket Queue pagination" });
    expect(within(emptyPagination).getByText("Page 1 of 1")).toBeInTheDocument();
    expect(within(emptyPagination).getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(within(emptyPagination).getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ticket Number/Summary search"), { target: { value: "missing" } });
    expect(await screen.findByText(/No Tickets match the current search or filters/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(defaults));
  });

  it("renders forbidden and invalid-query reset states while retaining controls", async () => {
    const forbidden = Object.assign(new Error("Forbidden"), { statusCode: 403, code: "ROLE_FORBIDDEN" });
    await renderQueue(staff, vi.spyOn(api, "getStaffTickets").mockRejectedValue(forbidden));
    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
  });

  it("resets an invalid query to defaults", async () => {
    const invalid = Object.assign(new Error("Invalid query"), { statusCode: 400, code: "INVALID_QUERY" });
    const queue = vi.spyOn(api, "getStaffTickets").mockRejectedValueOnce(invalid).mockResolvedValueOnce(response());
    await renderQueue(staff, queue);
    expect(await screen.findByRole("alert")).toHaveTextContent("query is invalid");
    fireEvent.click(screen.getByRole("button", { name: "Reset Queue" }));
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(defaults));
    expect(await screen.findByText("1 matching Ticket")).toBeInTheDocument();
  });

  it("keeps controls after a safe failure and retries", async () => {
    const queue = vi.spyOn(api, "getStaffTickets").mockRejectedValueOnce(new Error("Unable to load the Ticket Queue.")).mockResolvedValueOnce(response());
    await renderQueue(staff, queue);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load");
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("1 matching Ticket")).toBeInTheDocument();
    expect(queue).toHaveBeenCalledTimes(2);
  });

  it("offers First/Previous recovery for a beyond-end page", async () => {
    const queue = vi.spyOn(api, "getStaffTickets")
      .mockResolvedValueOnce(response({ pagination: { page: 1, pageSize: 10, totalItems: 11, totalPages: 2, hasPreviousPage: false, hasNextPage: true } }))
      .mockResolvedValueOnce(response({ items: [], pagination: { page: 2, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: true, hasNextPage: false } }))
      .mockResolvedValue(response());
    await renderQueue(staff, queue);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText(/beyond the available Queue results/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "First Page" }));
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  });

  it("allows Administrator access and preserves same-account query through the safe detail placeholder", async () => {
    const queue = await renderQueue(admin);
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ticket Number/Summary search"), { target: { value: "mailbox" } });
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "11" } });
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith(expect.objectContaining({ search: "mailbox", owner: 11, page: 1 })));
    fireEvent.click(screen.getAllByRole("button", { name: "Open TKT-2026-000059" })[0]);
    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByText(/reserved for Issues #62 and #75/)).toBeInTheDocument();
    expect(api.getStaffTickets).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "← Back to Queue" }));
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ticket Number/Summary search")).toHaveValue("mailbox");
    expect(screen.getByLabelText("Owner")).toHaveValue("11");
  });
});
