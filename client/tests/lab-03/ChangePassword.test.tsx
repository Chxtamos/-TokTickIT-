import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { csrfToken, requesterUser, setRoute } from "../auth-fixtures.js";

function emptyTickets(): api.TicketListResponse {
  return { items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } };
}

function renderChangePassword(mandatory: boolean) {
  setRoute("/change-password");
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user: { ...requesterUser, mustChangePassword: mandatory }, csrfToken });
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "getTickets").mockResolvedValue(emptyTickets());
  render(<App />);
  return screen.findByRole("heading", { name: mandatory ? "Change your initial password" : "Change Password" });
}

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); setRoute(); });

describe("Lab 3 Change Password", () => {
  it("keeps mandatory sessions restricted and explains the fixed deadline", async () => {
    await renderChangePassword(true);
    expect(screen.getByText(/expires 15 minutes after sign-in/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("validates the exact password policy and confirmation before saving", async () => {
    const save = vi.spyOn(api, "changePassword");
    await renderChangePassword(true);
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Password" }));
    expect(await screen.findByText(/New Password must be 15-128 characters/)).toBeInTheDocument();
    expect(screen.getByText("Passwords must match exactly.")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("opens the Requester landing page after a committed replacement session", async () => {
    vi.spyOn(api, "changePassword").mockResolvedValue({ user: requesterUser, csrfToken: "c".repeat(64) });
    await renderChangePassword(true);
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "old temporary password" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "a valid replacement password" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "a valid replacement password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Password" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/requester/tickets");
  });

  it("keeps the session on a rejected current password and clears secret fields", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(Object.assign(new Error("Current password is invalid."), { statusCode: 401, code: "CURRENT_PASSWORD_INVALID" }));
    await renderChangePassword(false);
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "incorrect current password" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "another valid password" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "another valid password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is invalid");
    expect(screen.getByRole("heading", { name: "Change Password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toHaveValue("");
    expect(screen.getByLabelText("New Password")).toHaveValue("");
  });

  it("returns an ambiguous network result to Login for new-password recovery", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(new TypeError("Failed to fetch"));
    await renderChangePassword(false);
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "current password value" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "another valid password" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "another valid password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Password" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sign in with the new password");
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
  });

  it("keeps a rejected pre-commit save retryable and clears all secrets", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(Object.assign(new Error("Unable to change the password. Please try again."), { statusCode: 500, code: "INTERNAL_ERROR" }));
    await renderChangePassword(false);
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "current password value" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "another valid password" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "another valid password" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to change the password");
    expect(screen.getByRole("button", { name: "Save Password" })).toBeEnabled();
    expect(screen.getByLabelText("Current Password")).toHaveValue("");
    expect(screen.getByLabelText("New Password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm New Password")).toHaveValue("");
  });
});
