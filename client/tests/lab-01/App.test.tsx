import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { mockCurrentUser, setRoute } from "../auth-fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setRoute();
});

describe("App bootstrap", () => {
  it("renders a labelled session-restoration state without protected content", () => {
    vi.spyOn(api, "getCurrentUser").mockImplementation(() => new Promise(() => undefined));
    render(<App />);
    expect(screen.getByRole("heading", { name: "Restoring your session" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  it("shows Login when no session exists", async () => {
    vi.spyOn(api, "getCurrentUser").mockRejectedValue(Object.assign(new Error("session required"), { statusCode: 401 }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("removes the retired requester identity key during bootstrap", async () => {
    sessionStorage.setItem("toktickit.requesterId", "99");
    setRoute("/requester/tickets");
    mockCurrentUser();
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
    vi.spyOn(api, "getTickets").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } });
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
    expect(screen.queryByText(/Development Requester/)).not.toBeInTheDocument();
  });
});
