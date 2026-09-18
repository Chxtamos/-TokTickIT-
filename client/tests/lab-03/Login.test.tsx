import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { requesterUser, setRoute } from "../auth-fixtures.js";

function renderLogin() {
  setRoute("/login");
  vi.spyOn(api, "getCurrentUser").mockRejectedValue(Object.assign(new Error("session required"), { statusCode: 401 }));
  render(<App />);
  return screen.findByRole("heading", { name: "Sign in" });
}

afterEach(() => { vi.restoreAllMocks(); api.clearInMemoryAuth(); setRoute(); });

describe("Lab 3 Login", () => {
  it("validates fields before calling the API and moves focus to email", async () => {
    const signIn = vi.spyOn(api, "login");
    await renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("uses generic credential feedback and clears the password", async () => {
    vi.spyOn(api, "login").mockRejectedValue(Object.assign(new Error("Unable to sign in with those credentials. Check your details or contact an administrator."), { statusCode: 401, code: "INVALID_CREDENTIALS" }));
    await renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in with those credentials");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.test");
  });

  it("shows a busy state and sends a successful initial-password login to the mandatory screen", async () => {
    let resolveLogin!: (value: api.AuthResponse) => void;
    vi.spyOn(api, "login").mockImplementation(() => new Promise((resolve) => { resolveLogin = resolve; }));
    await renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " Alice@Example.Test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "temporary password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(screen.getByRole("button", { name: "Signing In…" })).toBeDisabled();
    resolveLogin({ user: { ...requesterUser, mustChangePassword: true }, csrfToken: "b".repeat(64) });
    expect(await screen.findByRole("heading", { name: "Change your initial password" })).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith("alice@example.test", "temporary password");
    await waitFor(() => expect(window.location.pathname).toBe("/change-password"));
  });
});
