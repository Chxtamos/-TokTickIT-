import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TicketConversation } from "../../src/TicketConversation.js";
import * as api from "../../src/api.js";

const publicEntry: api.ConversationEntry = {
  id: 1,
  ticketId: 42,
  content: "Public line one\n<script>alert('x')</script>",
  author: { id: 1, name: "Alice Requester", role: "REQUESTER" },
  createdAt: "2026-09-18T08:00:00.000Z",
};
const internalEntry: api.ConversationEntry = {
  id: 2,
  ticketId: 42,
  content: "Private diagnostic note",
  author: { id: 10, name: "Support One", role: "IT_STAFF" },
  createdAt: "2026-09-18T09:00:00.000Z",
};

afterEach(() => vi.restoreAllMocks());

describe("UI-07 Public/Private conversations", () => {
  it("renders deterministic Public content as inert plain text with visibility guidance", async () => {
    vi.spyOn(api, "getPublicComments").mockResolvedValue([publicEntry]);
    render(<TicketConversation ticketId={42} kind="public" />);
    const section = (await screen.findByRole("heading", { name: "Public Comments" })).closest("section") as HTMLElement;
    expect(within(section).getByText("Visible to the Requester")).toBeInTheDocument();
    expect(within(section).getByText((text) => text.includes("<script>alert('x')</script>"))).toHaveClass("conversation-content");
    expect(section.querySelector("script")).toBeNull();
    expect(within(section).getByText("Alice Requester")).toBeInTheDocument();
    expect(within(section).getByText("REQUESTER")).toBeInTheDocument();
  });

  it("keeps Public and Internal drafts independent and posts to the correct destination", async () => {
    vi.spyOn(api, "getPublicComments").mockResolvedValue([]);
    vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);
    const postPublic = vi.spyOn(api, "postPublicComment").mockResolvedValue({ ...publicEntry, id: 3, content: "Public draft" });
    const postInternal = vi.spyOn(api, "postInternalNote").mockResolvedValue({ ...internalEntry, id: 4, content: "Private draft" });
    render(<><TicketConversation ticketId={42} kind="public" /><TicketConversation ticketId={42} kind="internal" /></>);
    await screen.findByText("No Public Comments yet.");
    await screen.findByText("No Internal Notes yet.");
    fireEvent.change(screen.getByLabelText("Public Comment"), { target: { value: "Public draft" } });
    fireEvent.change(screen.getByLabelText("Internal Note"), { target: { value: "Private draft" } });
    expect(screen.getByLabelText("Public Comment")).toHaveValue("Public draft");
    expect(screen.getByLabelText("Internal Note")).toHaveValue("Private draft");
    fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    await screen.findByText("Public Comment posted.");
    expect(postPublic).toHaveBeenCalledWith(42, "Public draft");
    expect(postInternal).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Public Comment")).toHaveValue("");
    expect(screen.getByLabelText("Internal Note")).toHaveValue("Private draft");
    fireEvent.click(screen.getByRole("button", { name: "Save Internal Note" }));
    await screen.findByText("Internal Note saved.");
    expect(postInternal).toHaveBeenCalledWith(42, "Private draft");
  });

  it("visually and semantically distinguishes Internal Notes from Public Comments", async () => {
    vi.spyOn(api, "getInternalNotes").mockResolvedValue([internalEntry]);
    render(<TicketConversation ticketId={42} kind="internal" />);
    const section = (await screen.findByRole("heading", { name: "Internal Notes" })).closest("section") as HTMLElement;
    expect(section).toHaveClass("conversation-private");
    expect(within(section).getByText(/Internal Note - visible only to IT Staff and Administrators/)).toBeInTheDocument();
    expect(within(section).getByText("Private diagnostic note")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: /delete|edit/i })).not.toBeInTheDocument();
  });

  it("validates the draft, focuses the textarea, and blocks repeated activation while posting", async () => {
    vi.spyOn(api, "getPublicComments").mockResolvedValue([]);
    let resolvePost!: (entry: api.ConversationEntry) => void;
    vi.spyOn(api, "postPublicComment").mockImplementation(() => new Promise((resolve) => { resolvePost = resolve; }));
    render(<TicketConversation ticketId={42} kind="public" />);
    await screen.findByText("No Public Comments yet.");
    const textarea = screen.getByLabelText("Public Comment");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(screen.getByText("Enter 1 to 5,000 characters.")).toBeInTheDocument();
    expect(textarea).toHaveFocus();
    fireEvent.change(textarea, { target: { value: "Valid public update" } });
    fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(screen.getByRole("button", { name: "Posting..." })).toBeDisabled();
    resolvePost({ ...publicEntry, id: 5, content: "Valid public update" });
    expect(await screen.findByText("Public Comment posted.")).toBeInTheDocument();
  });

  it("preserves a non-secret draft and reloads after an ambiguous network result", async () => {
    const get = vi.spyOn(api, "getInternalNotes").mockResolvedValueOnce([]).mockResolvedValueOnce([internalEntry]);
    vi.spyOn(api, "postInternalNote").mockRejectedValue(new Error("Network lost"));
    render(<TicketConversation ticketId={42} kind="internal" />);
    await screen.findByText("No Internal Notes yet.");
    const textarea = screen.getByLabelText("Internal Note");
    fireEvent.change(textarea, { target: { value: "Private draft kept for review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Internal Note" }));
    expect(await screen.findByText(/save result could not be confirmed/i)).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(textarea).toHaveValue("Private draft kept for review");
    expect(await screen.findByText("Private diagnostic note")).toBeInTheDocument();
  });
});
