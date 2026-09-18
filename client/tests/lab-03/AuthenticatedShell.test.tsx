import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { csrfToken, requesterUser, setRoute } from "../auth-fixtures.js";

function sessionFor(user: api.AuthUser) {
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user, csrfToken });
}

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); sessionStorage.clear(); setRoute(); });

describe("Lab 3 authenticated shell", () => {
  it("guards a wrong-role direct route without loading protected Requester data", async () => {
    setRoute("/admin/users");
    sessionFor(requesterUser);
    const getTickets = vi.spyOn(api, "getTickets");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Forbidden" })).toBeInTheDocument();
    expect(getTickets).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Go to your workspace" })).toBeInTheDocument();
  });

  it("renders safe role-specific landing placeholders and navigation", async () => {
    setRoute("/staff/tickets");
    sessionFor({ id: 8, name: "Support One", email: "support@example.test", role: "IT_STAFF", mustChangePassword: false });
    const first = render(<App />);
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
    first.unmount();

    vi.restoreAllMocks();
    setRoute("/admin/users");
    sessionFor({ id: 9, name: "Admin User", email: "admin@example.test", role: "ADMINISTRATOR", mustChangePassword: false });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
  });

  it("keeps the authenticated shell when logout fails and offers Retry", async () => {
    setRoute("/staff/tickets");
    sessionFor({ id: 8, name: "Support One", email: "support@example.test", role: "IT_STAFF", mustChangePassword: false });
    vi.spyOn(api, "logout").mockRejectedValue(new Error("Unable to log out. Please try again."));
    render(<App />);
    await screen.findByRole("heading", { name: "Ticket Queue" });
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to log out");
    expect(screen.getByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry logout" })).toBeInTheDocument();
  });

  it("clears the account shell after confirmed logout or session revocation", async () => {
    setRoute("/staff/tickets");
    sessionFor({ id: 8, name: "Support One", email: "support@example.test", role: "IT_STAFF", mustChangePassword: false });
    vi.spyOn(api, "logout").mockResolvedValue();
    render(<App />);
    await screen.findByRole("heading", { name: "Ticket Queue" });
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Support One · IT Staff")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("fails closed when an authenticated API reports a revoked session", async () => {
    setRoute("/staff/tickets");
    sessionFor({ id: 8, name: "Support One", email: "support@example.test", role: "IT_STAFF", mustChangePassword: false });
    render(<App />);
    await screen.findByRole("heading", { name: "Ticket Queue" });
    act(() => window.dispatchEvent(new CustomEvent("toktickit:session-invalid", { detail: { code: "SESSION_REQUIRED" } })));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Support One · IT Staff")).not.toBeInTheDocument();
  });
});
