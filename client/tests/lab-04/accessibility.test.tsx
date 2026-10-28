import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { mockCurrentUser, requesterUser, setRoute } from "../auth-fixtures.js";

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); sessionStorage.clear(); setRoute(); });

describe("Lab 4 accessibility hardening", () => {
  it("keeps Requester Dashboard semantic, labelled and keyboard focusable", async () => {
    setRoute("/requester/dashboard");
    mockCurrentUser(requesterUser);
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue({
      metrics: { openTickets: 2, waitingForRequester: 1 },
      recentlyUpdated: [],
      recentlyResolved: [],
      drillDown: { openTickets: "/my-tickets?state=open", waitingForRequester: "/my-tickets?status=WAITING_FOR_REQUESTER" },
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Requester Dashboard", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    const open = await screen.findByRole("button", { name: /Open Tickets/ });
    open.focus();
    expect(document.activeElement).toBe(open);
    expect(screen.getByRole("region", { name: "Requester metrics" })).toBeInTheDocument();
  });

  it("keeps Staff Dashboard status and priority controls understandable without color", async () => {
    setRoute("/staff/dashboard");
    mockCurrentUser({ ...requesterUser, id: 10, name: "Accessibility Staff", email: "a11y.staff@example.test", role: "IT_STAFF" });
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue({
      metrics: { unassignedTickets: 1, myTickets: 2, myOpenActions: 0 },
      byStatus: { NEW: 1, OPEN: 0, IN_PROGRESS: 2, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 },
      byItPriority: { LOW: 0, MEDIUM: 1, HIGH: 1, URGENT: 1 },
      recentOrUrgent: [],
      myOpenActionItems: [],
      myRecentActions: [],
      drillDown: { unassignedTickets: "/staff/tickets?owner=unassigned", myTickets: "/staff/tickets?owner=mine", myOpenActions: "/staff/dashboard#my-open-actions" },
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "IT Staff Dashboard", level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Unassigned Tickets/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /IN PROGRESS/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: /URGENT/ })).toHaveTextContent("1");
  });
});
