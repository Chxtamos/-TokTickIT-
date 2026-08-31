import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requesters = [
  { id: 1, name: "Alice Requester" },
  { id: 2, name: "Bob Requester" },
];

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("Development Requester selection and context", () => {
  it("loads active Requesters and keeps Continue disabled until selection", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(requesters);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Select a Development Requester" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Alice Requester" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob Requester" })).toBeInTheDocument();
  });

  it("shows a busy loading state while Requesters are being fetched", async () => {
    let resolveLoad!: (value: typeof requesters) => void;
    vi.spyOn(api, "getDevelopmentRequesters").mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));
    render(<App />);

    expect(screen.getByText("Loading Requesters…")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    resolveLoad(requesters);
    expect(await screen.findByLabelText("Development Requester")).toBeInTheDocument();
  });

  it("saves the selected Requester in sessionStorage and renders the shell", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(requesters);
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Development Requester"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Requester: Bob Requester")).toBeInTheDocument());
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("2");
    expect(screen.getByRole("button", { name: /My Tickets \(coming soon\)/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Create Ticket \(coming soon\)/i })).toBeDisabled();
  });

  it("restores a valid Requester and allows changing context", async () => {
    sessionStorage.setItem("toktickit.requesterId", "1");
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(requesters);
    render(<App />);
    expect(await screen.findByText("Requester: Alice Requester")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change Requester" }));
    expect(screen.getByRole("heading", { name: "Select a Development Requester" })).toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
    fireEvent.change(screen.getByLabelText("Development Requester"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Requester: Bob Requester")).toBeInTheDocument());
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("2");
  });

  it("shows a safe failure state with Retry", async () => {
    const load = vi.spyOn(api, "getDevelopmentRequesters").mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(requesters);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Development Requesters");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByLabelText("Development Requester")).toBeInTheDocument());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shows an actionable empty state when there are no active Requesters", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByText("No active Development Requesters are available.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
