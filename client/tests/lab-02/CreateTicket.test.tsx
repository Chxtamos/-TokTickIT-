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
    vi.spyOn(api, "uploadTicketAttachment").mockRejectedValue(new Error("Attachment unavailable"));
    await renderCreateTicket();
    fillValidForm();
    const input = screen.getByLabelText(/Attachments/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["%PDF-1.7"], "evidence.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(await screen.findByText(/evidence\.pdf: Attachment unavailable/)).toBeInTheDocument();
  });
});
