import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { mockCurrentUser, requesterUser, setRoute } from "../auth-fixtures.js";

const updatedTicket: api.TicketSummary = { id: 41, ticketNumber: "TKT-2026-000041", summary: "Recently updated VPN issue", category: { id: 1, name: "Network" }, relatedSystem: { id: 2, name: "VPN" }, requestedPriority: "HIGH", currentStatus: "IN_PROGRESS", createdAt: "2026-10-20T08:00:00.000Z", updatedAt: "2026-10-25T09:00:00.000Z" };
const resolvedTicket: api.TicketSummary = { ...updatedTicket, id: 42, ticketNumber: "TKT-2026-000042", summary: "Recently resolved laptop issue", currentStatus: "CLOSED", updatedAt: "2026-10-24T09:00:00.000Z" };
const dashboard = {
  metrics: { openTickets: 3, waitingForRequester: 1 },
  recentlyUpdated: [updatedTicket],
  recentlyResolved: [resolvedTicket],
  drillDown: { openTickets: "/my-tickets?state=open", waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER" },
};

function setupDashboard() {
  setRoute("/requester/dashboard");
  mockCurrentUser(requesterUser);
  const getDashboard = vi.spyOn(api as any, "getRequesterDashboard").mockResolvedValue(dashboard);
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "getTickets").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } });
  render(<App />);
  return getDashboard;
}

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); sessionStorage.clear(); setRoute(); });

describe("Lab 4 Requester Dashboard UI", () => {
  it("renders concise owned metrics and recent Ticket summaries", async () => {
    setupDashboard();
    expect(await screen.findByRole("heading", { name: "Requester Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Tickets/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /Waiting for Requester/ })).toHaveTextContent("1");
    expect(screen.getByText("Recently updated VPN issue")).toBeInTheDocument();
    expect(screen.getByText("Recently resolved laptop issue")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("drills metric cards into My Tickets with the contracted backend filters", async () => {
    setupDashboard();
    fireEvent.click(await screen.findByRole("button", { name: /Waiting for Requester/ }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    await waitFor(() => expect(api.getTickets).toHaveBeenCalledWith(expect.objectContaining({ currentStatus: "WAITING_FOR_REQUESTER", page: 1 })));
  });

  it("opens recent items in owned Ticket Detail", async () => {
    setupDashboard();
    vi.spyOn(api, "getTicketDetail").mockResolvedValue({ ...updatedTicket, ticketDate: updatedTicket.createdAt, requester: { id: requesterUser.id, name: requesterUser.name, email: requesterUser.email, role: "REQUESTER" }, description: "Owned detail.", attachments: [] });
    vi.spyOn(api, "getTicketActions").mockResolvedValue([]);
    vi.spyOn(api, "getPublicComments").mockResolvedValue([]);
    fireEvent.click(await screen.findByRole("button", { name: `Open ${updatedTicket.ticketNumber}` }));
    expect(await screen.findByRole("heading", { name: updatedTicket.ticketNumber })).toBeInTheDocument();
    expect(api.getTicketDetail).toHaveBeenCalledWith(updatedTicket.id);
  });

  it("provides safe failure retry and explicit empty state", async () => {
    setRoute("/requester/dashboard");
    mockCurrentUser(requesterUser);
    const getDashboard = vi.spyOn(api as any, "getRequesterDashboard")
      .mockRejectedValueOnce(new Error("Unable to load Requester Dashboard."))
      .mockResolvedValueOnce({ ...dashboard, metrics: { openTickets: 0, waitingForRequester: 0 }, recentlyUpdated: [], recentlyResolved: [] });
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Requester Dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/No Ticket work needs your attention right now/)).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });
});
