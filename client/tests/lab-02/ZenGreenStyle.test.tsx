import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Alice Requester" };
const category = { id: 1, name: "Hardware" };
const system = { id: 1, name: "Corporate Laptop" };
const ticket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  summary: "Laptop battery issue",
  category,
  relatedSystem: system,
  requestedPriority: "HIGH" as const,
  currentStatus: "NEW",
  createdAt: "2026-08-31T10:00:00.000Z",
  updatedAt: "2026-08-31T10:00:00.000Z",
};

const listResponse: api.TicketListResponse = {
  items: [ticket],
  pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
  applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" },
};

async function renderShell() {
  sessionStorage.setItem("toktickit.requesterId", "1");
  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue([category]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([system]);
  vi.spyOn(api, "getTickets").mockResolvedValue(listResponse);
  render(<App />);
  await screen.findByText("Welcome to TokTickIT");
}

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe("Lab 2 Zen Green visual semantics", () => {
  it("uses labelled required fields and consistent validation markers on Create Ticket", async () => {
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });

    expect(screen.getByLabelText(/Category/)).toBeRequired();
    expect(screen.getByLabelText(/Related System/)).toBeRequired();
    expect(screen.getByLabelText(/Summary/)).toBeRequired();
    expect(screen.getByLabelText(/Description/)).toBeRequired();
    expect(screen.getByText(/Fields marked/)).toBeInTheDocument();
    expect(screen.getAllByText("*").every((marker) => marker.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("distinguishes read-only fields and button hierarchy", async () => {
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });

    expect(screen.getByDisplayValue("Generated after submission")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("Recorded after submission")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("Alice Requester")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toHaveClass("button-primary");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("button-secondary");
  });

  it("shows equivalent desktop table and mobile card content with text-labelled states", async () => {
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    const table = await screen.findByRole("table");
    const card = document.querySelector(".ticket-card");
    expect(card).not.toBeNull();
    expect(within(table).getByText(ticket.ticketNumber)).toBeInTheDocument();
    expect(card).toHaveTextContent(ticket.ticketNumber);
    expect(card).toHaveTextContent("Requested Priority");
    expect(card).toHaveTextContent("Current Status");
    expect(within(table).getByRole("columnheader", { name: "Last Updated" })).toHaveAttribute("aria-sort", "descending");
  });

  it("keeps async busy and destructive states visible in text and semantics", async () => {
    let resolveCreate!: (value: { ticket: api.CreatedTicket; replayed: boolean }) => void;
    vi.spyOn(api, "createTicket").mockImplementation(() => new Promise<{ ticket: api.CreatedTicket; replayed: boolean }>((resolve) => { resolveCreate = resolve; }));
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });
    fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Related System/), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "Battery issue" } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "The laptop battery drains quickly." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    expect(document.querySelector("form.ticket-form")).toHaveAttribute("aria-busy", "true");
    resolveCreate({ ticket: ticket as api.CreatedTicket, replayed: false });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ticket created" })).toBeInTheDocument());
  });
});
