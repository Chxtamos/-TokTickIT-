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

async function renderShell(mockTickets = true) {
  sessionStorage.setItem("toktickit.requesterId", "1");
  vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([requester]);
  vi.spyOn(api, "getCategories").mockResolvedValue([category]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([system]);
  if (mockTickets) vi.spyOn(api, "getTickets").mockResolvedValue(listResponse);
  render(<App />);
  await screen.findByText("Welcome to TokTickIT");
}

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe("Lab 2 keyboard and accessibility contract", () => {
  it("exposes one primary heading and a labelled navigation landmark", async () => {
    await renderShell();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
  });

  it("updates aria-current to the active screen instead of relying on color", async () => {
    await renderShell();
    const workspace = screen.getByRole("link", { name: "Workspace" });
    expect(workspace).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(workspace).not.toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("navigation", { name: "Primary navigation" }).querySelector("button:last-of-type") as HTMLButtonElement);
    await screen.findByRole("heading", { name: "Create Ticket" });
    expect(screen.getByRole("button", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
  });

  it("associates validation errors with the first invalid control and moves focus there", async () => {
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));
    await screen.findByRole("heading", { name: "Create Ticket" });
    await waitFor(() => expect(screen.getByLabelText(/Category/)).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));
    const categoryControl = await screen.findByLabelText(/Category/);
    expect(categoryControl).toHaveAttribute("aria-invalid", "true");
    expect(categoryControl).toHaveAttribute("aria-describedby", "category-error");
    await waitFor(() => expect(document.activeElement).toBe(categoryControl));
  });

  it("announces loading and busy states without exposing stale requester data", async () => {
    let resolveTickets!: (value: api.TicketListResponse) => void;
    vi.spyOn(api, "getTickets").mockImplementation(() => new Promise((resolve) => { resolveTickets = resolve; }));
    await renderShell(false);
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    await screen.findByText("Loading Tickets…");
    const main = document.querySelector("main.tickets-page");
    expect(main).not.toBeNull();
    await waitFor(() => expect(main).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading Tickets…");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    resolveTickets(listResponse);
    await screen.findByRole("table");
  });

  it("keeps statuses and attachment actions understandable by text", async () => {
    await renderShell();
    fireEvent.click(screen.getByRole("button", { name: "My Tickets" }));
    await screen.findByRole("table");
    expect(within(screen.getByRole("table")).getByText("HIGH")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("NEW")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("button", { name: "View Ticket" })).toHaveAccessibleName("View Ticket");
  });
});
