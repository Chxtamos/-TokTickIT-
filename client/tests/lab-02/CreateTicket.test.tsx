import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Alice Requester" };
const ticket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  ticketDate: "2026-08-31T10:00:00.000Z",
  requester: { ...requester, email: "alice@example.test" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "Corporate Laptop" },
  summary: "Laptop battery issue",
  requestedPriority: "MEDIUM" as const,
  description: "Battery drains very quickly during normal use.",
  currentStatus: "NEW",
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
};

async function renderCreateTicket() {
  sessionStorage.setItem("toktickit.requesterId", "1");
  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Corporate Laptop" }]);
  render(<App />);
  await screen.findByText("Welcome to TokTickIT");
  fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
  await screen.findByRole("heading", { name: "Create Ticket" });
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/Related System/), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "Laptop battery issue" } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Battery drains very quickly during normal use." } });
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Create Ticket screen", () => {
  it("loads reference data and shows read-only Ticket fields", async () => {
    await renderCreateTicket();
    expect(screen.getByDisplayValue("Generated after submission")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("Recorded after submission")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("Alice Requester")).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/Requested Priority/)).toHaveValue("MEDIUM");
    expect(screen.getByRole("option", { name: "Hardware" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Corporate Laptop" })).toBeInTheDocument();
  });

  it("shows field-level validation without calling the API", async () => {
    const create = vi.spyOn(api, "createTicket");
    await renderCreateTicket();
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("Category is required.")).toBeInTheDocument();
    expect(screen.getByText("Summary must contain 5 to 120 characters.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a Ticket and shows the authoritative Ticket Number", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue({ ticket, replayed: false });
    vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({});
    await renderCreateTicket();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByRole("heading", { name: "Ticket created" })).toBeInTheDocument();
    expect(screen.getByText("TKT-2026-000042")).toBeInTheDocument();
  });

  it("disables repeated submission and shows a busy label", async () => {
    let resolveCreate!: (value: { ticket: typeof ticket; replayed: boolean }) => void;
    vi.spyOn(api, "createTicket").mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    await renderCreateTicket();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    resolveCreate({ ticket, replayed: false });
    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
  });

  it("preserves the form and shows a safe create failure", async () => {
    vi.spyOn(api, "createTicket").mockRejectedValue(new Error("Unable to create Ticket. Please try again."));
    await renderCreateTicket();
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create Ticket");
    expect(screen.getByDisplayValue("Laptop battery issue")).toBeInTheDocument();
  });

  it("retains form/files and reuses the same clientRequestId after create retry", async () => {
    const create = vi.spyOn(api, "createTicket")
      .mockRejectedValueOnce(new Error("Unable to create Ticket. Please try again."))
      .mockResolvedValueOnce({ ticket, replayed: true });
    vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({});
    await renderCreateTicket();
    fillValidForm();
    const attachment = new File(["content"], "evidence.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/Attachments/), { target: { files: [attachment] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create Ticket");
    expect(screen.getByRole("listitem")).toHaveTextContent("evidence.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    await screen.findByRole("heading", { name: "Ticket created" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1].clientRequestId).toBe(create.mock.calls[1][1].clientRequestId);
  });

  it("keeps invalid selected files visible and excludes them from upload", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue({ ticket, replayed: false });
    vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({});
    await renderCreateTicket();
    const input = screen.getByLabelText(/Attachments/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByRole("listitem")).toHaveTextContent("notes.txt");
    expect(screen.getByRole("listitem")).toHaveTextContent("Unsupported file type.");
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    await waitFor(() => expect(screen.getByText("Ticket created")).toBeInTheDocument());
    expect(api.uploadTicketAttachment).not.toHaveBeenCalled();
  });

  it("reports partial Attachment failure after Ticket success", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue({ ticket, replayed: false });
    const upload = vi.spyOn(api, "uploadTicketAttachment")
      .mockRejectedValueOnce(new Error("Attachment unavailable"))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    await renderCreateTicket();
    fillValidForm();
    const input = screen.getByLabelText(/Attachments/) as HTMLInputElement;
    const first = new File(["content"], "first.pdf", { type: "application/pdf" });
    const second = new File(["content"], "second.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [first, second] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText("first.pdf: Attachment unavailable")).toBeInTheDocument();
    expect(screen.getByText("second.pdf: Uploaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("first.pdf: Uploaded")).toBeInTheDocument());
    expect(upload).toHaveBeenCalledTimes(3);
    expect(upload.mock.calls[2][2]).toBe(first);
  });

  it("appends picker selections and keeps every over-quota file visible", async () => {
    await renderCreateTicket();
    const input = screen.getByLabelText(/Attachments/);
    fireEvent.change(input, { target: { files: [new File(["a"], "one.pdf"), new File(["b"], "two.pdf")] } });
    fireEvent.change(input, { target: { files: [new File(["c"], "three.pdf"), new File(["d"], "four.pdf"), new File(["e"], "five.pdf"), new File(["f"], "six.pdf")] } });
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getAllByRole("listitem")[5]).toHaveTextContent("Maximum five valid files");
  });

  it("does not let invalid files consume the five-file quota", async () => {
    vi.spyOn(api, "createTicket").mockResolvedValue({ ticket, replayed: false });
    const upload = vi.spyOn(api, "uploadTicketAttachment").mockResolvedValue({});
    await renderCreateTicket();
    const input = screen.getByLabelText(/Attachments/);
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" }), new File(["1"], "one.pdf"), new File(["2"], "two.pdf"), new File(["3"], "three.pdf"), new File(["4"], "four.pdf"), new File(["5"], "five.pdf")] } });
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    await screen.findByRole("heading", { name: "Ticket created" });
    expect(upload).toHaveBeenCalledTimes(5);
  });

  it("removes a selected file before submission", async () => {
    await renderCreateTicket();
    const input = screen.getByLabelText(/Attachments/);
    fireEvent.change(input, { target: { files: [new File(["x"], "remove-me.pdf")] } });
    expect(screen.getByRole("listitem")).toHaveTextContent("remove-me.pdf");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("remove-me.pdf")).not.toBeInTheDocument();
  });
});
