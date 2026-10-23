import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ActionsTakenSection } from "../../src/ActionsTaken.js";
import * as api from "../../src/api.js";

const requester: api.AuthUser = {
  id: 1,
  name: "Alice Requester",
  email: "alice@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
};

const staff: api.AuthUser = {
  id: 11,
  name: "Support One",
  email: "support.one@example.test",
  role: "IT_STAFF",
  mustChangePassword: false,
};

const admin: api.AuthUser = {
  id: 20,
  name: "Admin Owner",
  email: "admin@example.test",
  role: "ADMINISTRATOR",
  mustChangePassword: false,
};

const assignees: api.EligibleOwner[] = [
  { id: staff.id, name: staff.name, email: staff.email, role: "IT_STAFF" },
  { id: admin.id, name: admin.name, email: admin.email, role: "ADMINISTRATOR" },
];

const actions: api.ActionTaken[] = [
  {
    id: 101,
    ticketId: 42,
    workflowCycle: 1,
    description: "Collected VPN diagnostic logs from the affected workstation.",
    result: null,
    performedBy: { id: staff.id, name: staff.name },
    assignee: { id: staff.id, name: staff.name },
    status: "IN_PROGRESS",
    followUpRequired: true,
    followUpNote: "Confirm stability with the Requester after the profile refresh.",
    attachmentNotes: "Diagnostic output is attached to the Ticket.",
    version: 2,
    createdAt: "2026-10-23T08:00:00.000Z",
    updatedAt: "2026-10-23T08:30:00.000Z",
  },
  {
    id: 102,
    ticketId: 42,
    workflowCycle: 1,
    description: "Rebuilt the VPN profile and verified the tunnel.",
    result: "VPN tunnel remained stable during verification.",
    performedBy: { id: admin.id, name: admin.name },
    assignee: admin,
    status: "COMPLETED",
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    version: 3,
    createdAt: "2026-10-23T09:00:00.000Z",
    updatedAt: "2026-10-23T09:45:00.000Z",
  },
];

function mockActions(items: api.ActionTaken[] = actions) {
  return vi.spyOn(api, "getTicketActions").mockResolvedValue(items);
}

afterEach(() => vi.restoreAllMocks());

describe("Lab 4 Actions Taken", () => {
  it("shows multiple Actions oldest-first with operational controls only on editable rows", async () => {
    mockActions();
    render(<ActionsTakenSection ticketId={42} user={staff} assignees={assignees} />);

    expect(await screen.findByRole("heading", { name: "Actions Taken" })).toBeInTheDocument();
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Collected VPN diagnostic logs");
    expect(cards[1]).toHaveTextContent("Rebuilt the VPN profile");
    expect(cards[0]).toHaveTextContent("Support One");
    expect(cards[0]).toHaveTextContent("Follow-up required");
    expect(cards[0]).toHaveTextContent("Diagnostic output is attached");
    expect(screen.getByRole("button", { name: "Add Action" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("button", { name: "Edit Action" })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole("button", { name: "Edit Action" })).not.toBeInTheDocument();
    expect(within(cards[1]).getByText(/Terminal · read-only/)).toBeInTheDocument();
  });

  it("renders the same safe history read-only for a Requester with no create/edit/assign/status controls", async () => {
    mockActions();
    render(<ActionsTakenSection ticketId={42} user={requester} assignees={[]} />);

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("VPN tunnel remained stable during verification.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Action" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Action status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Assignee")).not.toBeInTheDocument();
  });

  it("validates create fields, shows conditional follow-up input, and preserves the draft on API validation failure", async () => {
    mockActions([]);
    const create = vi.spyOn(api, "createTicketAction").mockRejectedValue(Object.assign(new Error("Please correct the highlighted fields."), {
      statusCode: 400,
      code: "VALIDATION_FAILED",
      fieldErrors: { description: ["Description is invalid on the server."] },
    }));
    render(<ActionsTakenSection ticketId={42} user={staff} assignees={assignees} />);
    await screen.findByText("No Actions Taken yet.");

    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "bad" } });
    fireEvent.click(screen.getByLabelText("Follow-up required"));
    expect(screen.getByLabelText("Follow-up note")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByText(/Description must be 5 to 2,000/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Investigate intermittent VPN drops." } });
    fireEvent.change(screen.getByLabelText("Follow-up note"), { target: { value: "Ask the Requester to retest tomorrow." } });
    fireEvent.change(screen.getByLabelText("Attachment notes"), { target: { value: "See vpn-log.pdf on the Ticket." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText("Description is invalid on the server.")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("Investigate intermittent VPN drops.");
    expect(screen.getByLabelText("Follow-up note")).toHaveValue("Ask the Requester to retest tomorrow.");
    expect(screen.getByLabelText("Attachment notes")).toHaveValue("See vpn-log.pdf on the Ticket.");
  });

  it("creates an Action, disables submit while saving, and returns to the refreshed list", async () => {
    mockActions([]);
    let resolveCreate!: (value: { action: api.ActionTaken; replayed: boolean }) => void;
    const create = vi.spyOn(api, "createTicketAction").mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    render(<ActionsTakenSection ticketId={42} user={staff} assignees={assignees} />);
    await screen.findByText("No Actions Taken yet.");

    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Collect current Wi-Fi diagnostics." } });
    fireEvent.change(screen.getByLabelText("Assignee"), { target: { value: String(admin.id) } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(create).toHaveBeenCalledWith(42, expect.objectContaining({
      description: "Collect current Wi-Fi diagnostics.",
      assigneeId: admin.id,
      followUpRequired: false,
    }));

    const created: api.ActionTaken = { ...actions[0], id: 103, description: "Collect current Wi-Fi diagnostics.", assignee: { id: admin.id, name: admin.name }, status: "PENDING", version: 1 };
    resolveCreate({ action: created, replayed: false });
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
    expect(screen.getByText("Collect current Wi-Fi diagnostics.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Action" })).not.toBeInTheDocument();
  });

  it("edits permitted status/assignee fields and keeps terminal Actions read-only after success", async () => {
    mockActions([actions[0]]);
    const completed: api.ActionTaken = {
      ...actions[0],
      assignee: { id: admin.id, name: admin.name },
      result: "Connection remained stable for the verification window.",
      followUpRequired: false,
      followUpNote: null,
      status: "COMPLETED",
      version: 3,
    };
    const update = vi.spyOn(api, "updateTicketAction").mockResolvedValue(completed);
    render(<ActionsTakenSection ticketId={42} user={admin} assignees={assignees} />);
    const card = (await screen.findAllByRole("article"))[0];
    fireEvent.click(within(card).getByRole("button", { name: "Edit Action" }));

    fireEvent.change(screen.getByLabelText("Assignee"), { target: { value: String(admin.id) } });
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: completed.result! } });
    fireEvent.click(screen.getByLabelText("Follow-up required"));
    fireEvent.change(screen.getByLabelText("Action status"), { target: { value: "COMPLETED" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await screen.findByText("Action updated.");
    expect(update).toHaveBeenCalledWith(42, actions[0].id, expect.objectContaining({
      expectedVersion: 2,
      assigneeId: admin.id,
      status: "COMPLETED",
      result: completed.result,
      followUpRequired: false,
      followUpNote: null,
    }));
    expect(screen.getByText(/Terminal · read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Action" })).not.toBeInTheDocument();
  });

  it("retains edit input across a stale conflict and reloads authoritative Actions on request", async () => {
    const getActions = vi.spyOn(api, "getTicketActions")
      .mockResolvedValueOnce([actions[0]])
      .mockResolvedValueOnce([{ ...actions[0], description: "Authoritative server description.", version: 3 }]);
    vi.spyOn(api, "updateTicketAction").mockRejectedValue(Object.assign(new Error("The Action changed."), {
      statusCode: 409,
      code: "VERSION_CONFLICT",
    }));
    render(<ActionsTakenSection ticketId={42} user={staff} assignees={assignees} />);
    const card = (await screen.findAllByRole("article"))[0];
    fireEvent.click(within(card).getByRole("button", { name: "Edit Action" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "My retained local draft." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText(/Action changed while you were editing/)).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("My retained local draft.");
    fireEvent.click(screen.getByRole("button", { name: "Refresh Actions" }));
    await waitFor(() => expect(getActions).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Authoritative server description.")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveValue("My retained local draft.");
  });

  it("shows loading, empty and safe failure states with a retry", async () => {
    const getActions = vi.spyOn(api, "getTicketActions")
      .mockRejectedValueOnce(new Error("Unable to load Actions Taken."))
      .mockResolvedValueOnce([]);
    render(<ActionsTakenSection ticketId={42} user={requester} assignees={[]} />);

    expect(screen.getByText("Loading Actions Taken...")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Actions Taken.");
    fireEvent.click(screen.getByRole("button", { name: "Retry Actions" }));
    expect(await screen.findByText("No Actions Taken yet.")).toBeInTheDocument();
    expect(getActions).toHaveBeenCalledTimes(2);
  });
});
