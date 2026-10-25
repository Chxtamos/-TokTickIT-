import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { csrfToken, setRoute } from "../auth-fixtures.js";

const staff: api.AuthUser = { id: 10, name: "Dashboard Staff", email: "dashboard.staff@example.test", role: "IT_STAFF", mustChangePassword: false };
const openAssignedAction: api.ActionTaken = { id: 9, ticketId: 59, workflowCycle: 1, description: "Open assigned action that must remain discoverable", result: null, performedBy: { id: 20, name: "Other Staff" }, assignee: { id: 10, name: "Dashboard Staff" }, status: "IN_PROGRESS", followUpRequired: false, followUpNote: null, attachmentNotes: null, version: 2, createdAt: "2026-10-20T08:20:00.000Z", updatedAt: "2026-10-20T09:05:00.000Z" };
const newerCompletedAction: api.ActionTaken = { id: 10, ticketId: 59, workflowCycle: 1, description: "Newer completed recent history", result: "Completed.", performedBy: { id: 10, name: "Dashboard Staff" }, assignee: { id: 20, name: "Other Staff" }, status: "COMPLETED", followUpRequired: false, followUpNote: null, attachmentNotes: null, version: 3, createdAt: "2026-10-24T08:20:00.000Z", updatedAt: "2026-10-24T09:05:00.000Z" };
const dashboard = {
  metrics: { unassignedTickets: 2, myTickets: 3, myOpenActions: 1 },
  byStatus: { NEW: 1, OPEN: 2, IN_PROGRESS: 3, WAITING_FOR_REQUESTER: 1, RESOLVED: 4, CLOSED: 5, REOPENED: 1, CANCELLED: 2 },
  byItPriority: { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 },
  recentOrUrgent: [{ id: 59, ticketNumber: "TKT-2026-000059", summary: "Urgent mailbox issue", category: { id: 2, name: "Access" }, relatedSystem: { id: 7, name: "Email" }, requestedPriority: "HIGH", itPriority: "URGENT", currentStatus: "IN_PROGRESS", version: 3, ticketOwner: null, requester: { id: 1, name: "Alice", email: "alice@example.test", role: "REQUESTER" }, createdAt: "2026-10-24T08:00:00.000Z", updatedAt: "2026-10-24T09:00:00.000Z" }],
  myOpenActionItems: [openAssignedAction],
  myRecentActions: [newerCompletedAction],
  drillDown: { unassignedTickets: "/staff/tickets?owner=unassigned", myTickets: "/staff/tickets?owner=mine", myOpenActions: "/staff/dashboard#my-open-actions" },
};

function setupDashboard(user: api.AuthUser = staff) {
  setRoute("/staff/dashboard");
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user, csrfToken });
  const getDashboard = vi.spyOn(api as any, "getStaffDashboard").mockResolvedValue(dashboard);
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValue([]);
  vi.spyOn(api, "getStaffTickets").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, itPriority: null, currentStatus: null, owner: "all", sortBy: "updatedAt", sortDirection: "desc" } });
  render(<App />);
  return getDashboard;
}

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); sessionStorage.clear(); setRoute(); });

describe("Lab 4 Staff Dashboard UI", () => {
  it("renders authoritative metrics, status/priority summaries and bounded operational lists", async () => {
    setupDashboard();
    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Urgent mailbox issue")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".dashboard-metric-value" })).toBeInTheDocument();
    expect(screen.getByText("Open assigned action that must remain discoverable")).toBeInTheDocument();
    expect(screen.getByText("Newer completed recent history")).toBeInTheDocument();
    expect(screen.getByText("WAITING FOR REQUESTER")).toBeInTheDocument();
    expect(screen.getByText("URGENT")).toBeInTheDocument();
  });

  it("drills metric cards into the existing Queue with the intended filter", async () => {
    setupDashboard();
    fireEvent.click(await screen.findByRole("button", { name: /Unassigned Tickets/ }));
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    await waitFor(() => expect(api.getStaffTickets).toHaveBeenCalledWith(expect.objectContaining({ owner: "unassigned", page: 1 })));
  });

  it("drills My Open Actions to the exact assigned open work even when recent history contains newer completed work", async () => {
    setupDashboard();
    const link = await screen.findByRole("link", { name: /My Open Actions/ });
    expect(link).toHaveAttribute("href", "#my-open-actions");
    const openHeading = screen.getByRole("heading", { name: "My Open Actions" });
    const openSection = openHeading.closest("section");
    expect(openSection).not.toBeNull();
    expect(openSection!).toHaveTextContent("Open assigned action that must remain discoverable");
    expect(openSection!).not.toHaveTextContent("Newer completed recent history");
    const recentHeading = screen.getByRole("heading", { name: "My Recent Actions" });
    const recentSection = recentHeading.closest("section");
    expect(recentSection).not.toBeNull();
    expect(recentSection!).toHaveTextContent("Newer completed recent history");
    expect(recentSection!).not.toHaveTextContent("Open assigned action that must remain discoverable");
  });

  it("provides loading/error retry and an explicit empty operational state", async () => {
    setRoute("/staff/dashboard");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: staff, csrfToken });
    const getDashboard = vi.spyOn(api as any, "getStaffDashboard")
      .mockRejectedValueOnce(new Error("Unable to load Staff Dashboard."))
      .mockResolvedValueOnce({ ...dashboard, metrics: { unassignedTickets: 0, myTickets: 0, myOpenActions: 0 }, recentOrUrgent: [], myOpenActionItems: [], myRecentActions: [] });
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Staff Dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/No active Ticket or Action work needs attention/)).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });
});
