import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StaffTicketDetailScreen } from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const staff: api.AuthUser = { id: 10, name: "Workflow Staff", email: "workflow.staff@example.test", role: "IT_STAFF", mustChangePassword: false };

function detail(status: api.TicketStatus, version = 7): api.TicketDetail {
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    ticketDate: "2026-10-24T08:00:00.000Z",
    requester: { id: 1, name: "Requester", email: "requester@example.test", role: "REQUESTER" },
    category: { id: 1, name: "Network" },
    relatedSystem: { id: 1, name: "VPN" },
    summary: "Workflow UI fixture",
    description: "Ticket used to verify the Lab 4 workflow user interface.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: status,
    version,
    ticketOwner: { id: staff.id, name: staff.name, email: staff.email, role: "IT_STAFF" },
    resolutionSummary: status === "RESOLVED" || status === "CLOSED" ? "Stored verified resolution." : null,
    resolvedAt: status === "RESOLVED" || status === "CLOSED" ? "2026-10-24T09:00:00.000Z" : null,
    closedAt: status === "CLOSED" ? "2026-10-24T10:00:00.000Z" : null,
    lastStatusReason: null,
    requesterResolvedAt: "2026-10-24T08:30:00.000Z",
    requesterResolvedBy: { id: 1, name: "Requester", email: "requester@example.test", role: "REQUESTER" },
    createdAt: "2026-10-24T08:00:00.000Z",
    updatedAt: "2026-10-24T09:00:00.000Z",
    attachments: [],
  };
}

function setup(initial: api.TicketDetail) {
  vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(initial);
  vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValue([]);
  vi.spyOn(api, "getTicketActions").mockResolvedValue([]);
  vi.spyOn(api, "getPublicComments").mockResolvedValue([]);
  vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);
  render(<StaffTicketDetailScreen user={staff} ticketId={initial.id} onBack={vi.fn()} />);
}

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Ticket workflow UI", () => {
  it.each([
    ["NEW", ["OPEN", "CANCELLED"]],
    ["OPEN", ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"]],
    ["IN_PROGRESS", ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]],
    ["WAITING_FOR_REQUESTER", ["IN_PROGRESS", "RESOLVED", "CANCELLED"]],
    ["RESOLVED", ["CLOSED", "REOPENED"]],
    ["CLOSED", ["REOPENED"]],
    ["REOPENED", ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"]],
  ] as Array<[api.TicketStatus, api.TicketStatus[]]>) ("offers only contracted next statuses from %s", async (status, expected) => {
    setup(detail(status));
    const select = await screen.findByLabelText("Next status");
    const options = within(select).getAllByRole("option").map((option) => option.getAttribute("value")).filter(Boolean);
    expect(options).toEqual(expected);
  });

  it("shows the current-cycle Actions requirement before a RESOLVED confirmation", async () => {
    setup(detail("IN_PROGRESS"));
    fireEvent.change(await screen.findByLabelText("Next status"), { target: { value: "RESOLVED" } });
    expect(screen.getByText(/current workflow cycle/i)).toBeInTheDocument();
    expect(screen.getByText(/completed Action/i)).toBeInTheDocument();
  });

  it("surfaces resolution-gate failure without discarding the Resolution Summary draft", async () => {
    vi.spyOn(api, "updateStaffTicketStatus").mockRejectedValue(Object.assign(new Error("Current-cycle Actions are incomplete."), {
      statusCode: 409,
      code: "RESOLUTION_ACTIONS_INCOMPLETE",
    }));
    setup(detail("IN_PROGRESS"));
    fireEvent.change(await screen.findByLabelText("Next status"), { target: { value: "RESOLVED" } });
    fireEvent.change(screen.getByLabelText(/Resolution Summary/), { target: { value: "VPN profile was rebuilt and verified with the Requester." } });
    fireEvent.click(screen.getByRole("button", { name: "Change Status" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Status Change" }));
    expect(await screen.findByText(/complete all current-cycle Actions/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resolution Summary/)).toHaveValue("VPN profile was rebuilt and verified with the Requester.");
  });

  it("refreshes authoritative summary after a successful status change", async () => {
    vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue(detail("WAITING_FOR_REQUESTER", 8));
    setup(detail("IN_PROGRESS", 7));
    fireEvent.change(await screen.findByLabelText("Next status"), { target: { value: "WAITING_FOR_REQUESTER" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Status" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Status Change" }));
    expect(await screen.findByText("Status changed to WAITING FOR REQUESTER.")).toBeInTheDocument();
    expect(screen.getAllByText("WAITING FOR REQUESTER").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/version 8/).length).toBeGreaterThan(0);
  });
});
