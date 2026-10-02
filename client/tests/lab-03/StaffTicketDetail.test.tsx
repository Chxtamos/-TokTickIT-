import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StaffTicketDetailScreen } from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const staff: api.AuthUser = { id: 10, name: "Support One", email: "support.one@example.test", role: "IT_STAFF", mustChangePassword: false };
const owner: api.EligibleOwner = { id: 11, name: "Support Two", email: "support.two@example.test", role: "IT_STAFF" };
const adminOwner: api.EligibleOwner = { id: 20, name: "Admin Owner", email: "admin.owner@example.test", role: "ADMINISTRATOR" };

function makeDetail(overrides: Partial<api.TicketDetail> = {}): api.TicketDetail {
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    ticketDate: "2026-09-18T08:00:00.000Z",
    requester: { id: 1, name: "Alice Requester", email: "alice@example.test", role: "REQUESTER" },
    category: { id: 2, name: "Network" },
    relatedSystem: { id: 7, name: "VPN" },
    summary: "VPN disconnects during meetings",
    description: "Requester-submitted description\nwith a second line.",
    requestedPriority: "HIGH",
    itPriority: "MEDIUM",
    currentStatus: "IN_PROGRESS",
    version: 7,
    ticketOwner: owner,
    resolutionSummary: null,
    resolvedAt: null,
    closedAt: null,
    lastStatusReason: null,
    requesterResolvedAt: "2026-09-18T09:00:00.000Z",
    requesterResolvedBy: { id: 1, name: "Alice Requester", email: "alice@example.test", role: "REQUESTER" },
    createdAt: "2026-09-18T08:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
    attachments: [
      { id: 12, originalName: "vpn-log.pdf", mimeType: "application/pdf", sizeBytes: 2048, state: "ACTIVE", uploadedAt: "2026-09-18T08:05:00.000Z", removedAt: null, removedReason: null, downloadUrl: "/api/tickets/42/attachments/12/download" },
      { id: 13, originalName: "old.png", mimeType: "image/png", sizeBytes: 1024, state: "REMOVED", uploadedAt: "2026-09-18T08:06:00.000Z", removedAt: "2026-09-18T09:30:00.000Z", removedReason: "Superseded", downloadUrl: null },
    ],
    ...overrides,
  };
}

function mockConversationApis() {
  vi.spyOn(api, "getPublicComments").mockResolvedValue([]);
  vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);
}

async function renderDetail(detail = makeDetail()) {
  vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(detail);
  vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValue([owner, adminOwner]);
  mockConversationApis();
  render(<StaffTicketDetailScreen user={staff} ticketId={detail.id} onBack={vi.fn()} />);
  await screen.findByRole("heading", { name: detail.ticketNumber });
  return detail;
}

afterEach(() => { vi.restoreAllMocks(); });

describe("UI-06 integrated Staff Ticket Detail", () => {
  it("keeps submitted values read-only and exposes only permitted operational controls", async () => {
    await renderDetail();
    expect(screen.getByRole("heading", { name: "Submitted Ticket Information" })).toBeInTheDocument();
    expect(screen.getByText("VPN disconnects during meetings")).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes("Requester-submitted description") && text.includes("second line"))).toBeInTheDocument();
    expect(screen.getByLabelText("Eligible owner")).toHaveValue("11");
    expect(screen.queryByRole("button", { name: /Unassign/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toHaveValue("MEDIUM");
    const status = screen.getByLabelText("Next status");
    expect(within(status).getByRole("option", { name: "WAITING FOR REQUESTER" })).toBeInTheDocument();
    expect(within(status).getByRole("option", { name: "RESOLVED" })).toBeInTheDocument();
    expect(within(status).getByRole("option", { name: "CANCELLED" })).toBeInTheDocument();
    expect(within(status).queryByRole("option", { name: "CLOSED" })).not.toBeInTheDocument();
    expect(screen.getByText(/Requester indication/)).toBeInTheDocument();
    expect(screen.getAllByText(/Sep/).length).toBeGreaterThan(0);
    const removed = screen.getByText("old.png").closest("li");
    expect(removed).not.toBeNull();
    expect(within(removed as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Add Attachment/)).not.toBeInTheDocument();
  });

  it("claims an unassigned Ticket with the loaded version and keeps formal status unchanged", async () => {
    const initial = makeDetail({ ticketOwner: null, version: 3, currentStatus: "IN_PROGRESS" });
    const claimed = makeDetail({ ticketOwner: { ...staff, role: "IT_STAFF" }, version: 4, currentStatus: "IN_PROGRESS" });
    vi.spyOn(api, "claimStaffTicket").mockResolvedValue(claimed);
    await renderDetail(initial);
    fireEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
    await screen.findByText("Ticket claimed. Status was not changed.");
    expect(api.claimStaffTicket).toHaveBeenCalledWith(42, 3);
    expect(screen.getByText("Current owner:").parentElement).toHaveTextContent("Support One");
    expect(screen.getAllByText("IN PROGRESS").length).toBeGreaterThan(0);
  });

  it("requires confirmation for assign/reassign and returns focus to the action", async () => {
    const updated = makeDetail({ ticketOwner: adminOwner, version: 8 });
    vi.spyOn(api, "assignStaffTicketOwner").mockResolvedValue(updated);
    await renderDetail();
    fireEvent.change(screen.getByLabelText("Eligible owner"), { target: { value: "20" } });
    const button = screen.getByRole("button", { name: "Reassign Owner" });
    fireEvent.click(button);
    expect(screen.getByRole("dialog")).toHaveTextContent("Reassign Ticket owner?");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Reassignment" }));
    await screen.findByText("Ticket owner reassigned.");
    expect(api.assignStaffTicketOwner).toHaveBeenCalledWith(42, 20, 7);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Operational Controls" })).toHaveFocus());
  });

  it("changes IT Priority independently from Requested Priority", async () => {
    const updated = makeDetail({ itPriority: "URGENT", version: 8 });
    vi.spyOn(api, "updateStaffTicketPriority").mockResolvedValue(updated);
    await renderDetail();
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "URGENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    await screen.findByText(/Requested Priority remains unchanged/);
    expect(api.updateStaffTicketPriority).toHaveBeenCalledWith(42, "URGENT", 7);
    expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0);
  });

  it("validates and confirms RESOLVED with the public Resolution Summary", async () => {
    const resolved = makeDetail({ currentStatus: "RESOLVED", version: 8, resolutionSummary: "Root cause corrected and VPN profile refreshed.", resolvedAt: "2026-09-18T11:00:00.000Z" });
    vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue(resolved);
    await renderDetail();
    fireEvent.change(screen.getByLabelText("Next status"), { target: { value: "RESOLVED" } });
    fireEvent.change(await screen.findByLabelText(/Resolution Summary/), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Status" }));
    expect(screen.getByText(/Resolution Summary must be 10 to 2,000/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resolution Summary/)).toHaveFocus();
    fireEvent.change(screen.getByLabelText(/Resolution Summary/), { target: { value: "Root cause corrected and VPN profile refreshed." } });
    fireEvent.click(screen.getByRole("button", { name: "Change Status" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Change status to RESOLVED?");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Status Change" }));
    await screen.findByText("Status changed to RESOLVED.");
    expect(api.updateStaffTicketStatus).toHaveBeenCalledWith(42, { currentStatus: "RESOLVED", expectedVersion: 7, resolutionSummary: "Root cause corrected and VPN profile refreshed." });
  });

  it("traps confirmation focus, closes with Escape, and returns focus to the invoking action", async () => {
    vi.spyOn(api, "assignStaffTicketOwner").mockResolvedValue(makeDetail({ ticketOwner: adminOwner, version: 8 }));
    await renderDetail();
    fireEvent.change(screen.getByLabelText("Eligible owner"), { target: { value: "20" } });
    const action = screen.getByRole("button", { name: "Reassign Owner" });
    fireEvent.click(action);
    const dialog = screen.getByRole("dialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirmButton = within(dialog).getByRole("button", { name: "Confirm Reassignment" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirmButton).toHaveFocus();
    fireEvent.keyDown(confirmButton, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(action).toHaveFocus());
  });

  it("recovers from an ineligible assignee by refreshing authoritative owner choices", async () => {
    const getDetail = vi.spyOn(api, "getStaffTicketDetail").mockResolvedValue(makeDetail());
    const eligible = vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValueOnce([owner, adminOwner]).mockResolvedValueOnce([owner]);
    mockConversationApis();
    vi.spyOn(api, "assignStaffTicketOwner").mockRejectedValue(Object.assign(new Error("Assignee invalid"), { statusCode: 400, code: "ASSIGNEE_INVALID" }));
    render(<StaffTicketDetailScreen user={staff} ticketId={42} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: "TKT-2026-000042" });
    fireEvent.change(screen.getByLabelText("Eligible owner"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Reassign Owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Reassignment" }));
    expect(await screen.findByText(/selected owner is no longer eligible/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh owners and Ticket" }));
    await waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(eligible).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Eligible owner")).toHaveValue("11");
    expect(within(screen.getByLabelText("Eligible owner")).queryByRole("option", { name: /Admin Owner/ })).not.toBeInTheDocument();
  });
  it("shows terminal rules and never offers manual unassign", async () => {
    await renderDetail(makeDetail({ currentStatus: "CLOSED", resolutionSummary: "Resolved before closure." }));
    expect(screen.getByText(/Closed Tickets cannot be assigned or reprioritized/)).toBeInTheDocument();
    expect(screen.getByLabelText("IT Priority")).toBeDisabled();
    expect(screen.queryByLabelText("Eligible owner")).not.toBeInTheDocument();
    const status = screen.getByLabelText("Next status");
    expect(within(status).getByRole("option", { name: "REOPENED" })).toBeInTheDocument();
    expect(within(status).queryByRole("option", { name: "CANCELLED" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unassign/i })).not.toBeInTheDocument();
  });

  it("retains an unsaved priority draft across 409 Refresh/review", async () => {
    const initial = makeDetail({ itPriority: "MEDIUM", version: 7 });
    const refreshed = makeDetail({ itPriority: "HIGH", version: 8, updatedAt: "2026-09-18T11:00:00.000Z" });
    const getDetail = vi.spyOn(api, "getStaffTicketDetail").mockResolvedValueOnce(initial).mockResolvedValueOnce(refreshed);
    vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValue([owner, adminOwner]);
    mockConversationApis();
    vi.spyOn(api, "updateStaffTicketPriority").mockRejectedValue(Object.assign(new Error("The Ticket changed."), { statusCode: 409, code: "VERSION_CONFLICT" }));
    render(<StaffTicketDetailScreen user={staff} ticketId={42} onBack={vi.fn()} />);
    await screen.findByRole("heading", { name: initial.ticketNumber });
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "URGENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect(await screen.findByText(/Refresh the authoritative Ticket/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Ticket" }));
    await waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("IT Priority")).toHaveValue("URGENT");
    expect(screen.getAllByText(/version 8/).length).toBeGreaterThan(0);
  });

  it("shows safe not-found and forbidden states without Ticket content", async () => {
    vi.spyOn(api, "getStaffTicketDetail").mockRejectedValue(Object.assign(new Error("Ticket not found."), { statusCode: 404 }));
    vi.spyOn(api, "getEligibleTicketOwners").mockResolvedValue([]);
    render(<StaffTicketDetailScreen user={staff} ticketId={999} onBack={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ticket not found or unavailable");
    expect(screen.queryByText("VPN disconnects during meetings")).not.toBeInTheDocument();
  });
});
