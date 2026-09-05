import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Alice Requester" };
const category = { id: 1, name: "Hardware" };
const system = { id: 1, name: "Corporate Laptop" };
const activeAttachment: api.TicketAttachmentMetadata = { id: 10, originalName: "battery.pdf", mimeType: "application/pdf", sizeBytes: 2048, state: "ACTIVE", uploadedAt: "2026-08-31T10:05:00.000Z", removedAt: null, removedReason: null, downloadUrl: "/api/tickets/42/attachments/10/download" };
const removedAttachment: api.TicketAttachmentMetadata = { id: 11, originalName: "old-photo.jpg", mimeType: "image/jpeg", sizeBytes: 4096, state: "REMOVED", uploadedAt: "2026-08-31T10:06:00.000Z", removedAt: "2026-08-31T10:20:00.000Z", removedReason: "Duplicate file", downloadUrl: null };
const ticket: api.TicketDetail = { id: 42, ticketNumber: "TKT-2026-000042", ticketDate: "2026-08-31T10:00:00.000Z", requester: { ...requester, email: "alice@example.com" }, category, relatedSystem: system, summary: "Laptop battery issue", requestedPriority: "HIGH", description: "Battery drains quickly", currentStatus: "NEW", createdAt: "2026-08-31T10:00:00.000Z", updatedAt: "2026-08-31T10:30:00.000Z", attachments: [activeAttachment] };
const listResponse: api.TicketListResponse = { items: [{ id: 42, ticketNumber: ticket.ticketNumber, summary: ticket.summary, category, relatedSystem: system, requestedPriority: ticket.requestedPriority, currentStatus: ticket.currentStatus, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } };

async function renderDetail(getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket)) {
  sessionStorage.setItem("toktickit.requesterId", "1");
  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue([category]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([system]);
  vi.spyOn(api, "getTickets").mockResolvedValue(listResponse);
  render(<App />);
  await screen.findByText("Requester: Alice Requester");
  fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
  await screen.findByRole("table");
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "View Ticket" }));
  await screen.findByRole("heading", { name: ticket.ticketNumber });
  return getDetail;
}

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe("Attachment section", () => {
  it("downloads an active owned Attachment with requester context", async () => {
    const download = vi.spyOn(api, "downloadTicketAttachment").mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(1, 42, 10));
  });

  it("queues a valid file and refreshes authoritative metadata after upload", async () => {
    const upload = vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({});
    const getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    await renderDetail(getDetail);
    const file = new File(["pdf"], "new.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Add Attachment/), { target: { files: [file] } });
    expect(within(screen.getByRole("list", { name: "Pending Attachments" })).getByRole("listitem")).toHaveTextContent("new.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(1, 42, file));
    await waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("new.pdf")).not.toBeInTheDocument();
  });

  it("retains a failed upload with an individual Retry action", async () => {
    const file = new File(["pdf"], "retry.pdf", { type: "application/pdf" });
    const upload = vi.spyOn(api, "uploadTicketAttachment").mockRejectedValueOnce(new Error("Upload failed")).mockResolvedValueOnce({});
    await renderDetail();
    fireEvent.change(screen.getByLabelText(/Add Attachment/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("Upload failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
  });

  it("shows invalid MIME, duplicate, and over-limit files instead of dropping them", async () => {
    await renderDetail();
    const input = screen.getByLabelText(/Add Attachment/);
    const duplicateA = new File(["x"], "same.pdf", { type: "application/pdf", lastModified: 1 });
    const duplicateB = new File(["x"], "same.pdf", { type: "application/pdf", lastModified: 1 });
    fireEvent.change(input, { target: { files: [new File(["x"], "bad.txt", { type: "text/plain" }), new File(["x"], "wrong.pdf", { type: "image/png" }), duplicateA, duplicateB, new File(["different content"], "battery.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
    expect(screen.getByText(/extension and MIME type/)).toBeInTheDocument();
    expect(screen.getByText("This file is already selected.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Pending Attachments" })).getAllByRole("listitem")).toHaveLength(5);
  });

  it("traps focus in the removal dialog, closes on Escape, and restores the trigger focus", async () => {
    await renderDetail();
    const trigger = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const reason = screen.getByLabelText("Reason");
    const confirm = screen.getByRole("button", { name: "Confirm removal" });
    expect(document.activeElement).toBe(reason);
    confirm.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(reason);
    reason.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it("requires a valid removal reason and soft-removes an active Attachment", async () => {
    const remove = vi.spyOn(api, "removeTicketAttachment").mockResolvedValue({ ...activeAttachment, state: "REMOVED", removedAt: "2026-09-01T10:00:00.000Z", removedReason: "No longer needed", downloadUrl: null });
    await renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("between 5 and 250");
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "No longer needed" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1, 42, 10, "No longer needed"));
  });

  it("shows Removing busy state and prevents repeated removal while the request is pending", async () => {
    let resolveRemove!: (value: api.TicketAttachmentMetadata) => void;
    const remove = vi.spyOn(api, "removeTicketAttachment").mockImplementation(() => new Promise((resolve) => { resolveRemove = resolve; }));
    const getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue(ticket);
    await renderDetail(getDetail);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "No longer needed" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(await screen.findByRole("button", { name: "Removing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(remove).toHaveBeenCalledTimes(1);
    resolveRemove({ ...activeAttachment, state: "REMOVED", removedAt: "2026-09-01T10:00:00.000Z", removedReason: "No longer needed", downloadUrl: null });
    await waitFor(() => expect(getDetail).toHaveBeenCalledTimes(2));
  });

  it("keeps a real sixth selection visible and marks it over quota when four active files already exist", async () => {
    const fourActive: api.TicketAttachmentMetadata[] = [activeAttachment, 12, 13, 14].map((entry, index) => index === 0 ? activeAttachment : { ...activeAttachment, id: entry as number, originalName: `existing-${entry as number}.pdf` });
    const getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue({ ...ticket, attachments: fourActive });
    await renderDetail(getDetail);
    fireEvent.change(screen.getByLabelText(/Add Attachment/), { target: { files: [new File(["a"], "fifth.pdf", { type: "application/pdf" }), new File(["b"], "sixth.pdf", { type: "application/pdf" })] } });
    const pending = screen.getByRole("list", { name: "Pending Attachments" });
    expect(within(pending).getByText("fifth.pdf")).toBeInTheDocument();
    expect(within(pending).getByText("sixth.pdf")).toBeInTheDocument();
    expect(within(pending).getByText("Maximum 5 active Attachments reached.")).toBeInTheDocument();
  });

  it("does not expose actions for removed Attachments and maps storage failures safely", async () => {
    const getDetail = vi.spyOn(api, "getTicketDetail").mockResolvedValue({ ...ticket, attachments: [activeAttachment, removedAttachment] });
    const download = vi.spyOn(api, "downloadTicketAttachment").mockRejectedValue(Object.assign(new Error("storage path leaked"), { statusCode: 500 }));
    await renderDetail(getDetail);
    expect(screen.getByText("Removed · Duplicate file")).toBeInTheDocument();
    const removedRow = screen.getByText("old-photo.jpg").closest("li");
    expect(removedRow).not.toBeNull();
    expect(within(removedRow as HTMLElement).queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(within(removedRow as HTMLElement).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("File temporarily unavailable");
    expect(download).toHaveBeenCalledWith(1, 42, 10);
  });
});
