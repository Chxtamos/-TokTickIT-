import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);

    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows the Lab 2 requester guard before requester-owned content", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([{ id: 1, name: "Alice Requester" }]);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Select a Development Requester" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome to TokTickIT" })).not.toBeInTheDocument();
  });

  it("does not render the retired Lab 1 SystemCheck demo on the Lab 2 selector", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([{ id: 1, name: "Alice Requester" }]);
    render(<App />);
    await screen.findByLabelText("Development Requester");
    expect(screen.queryByRole("button", { name: "Check System" })).not.toBeInTheDocument();
  });
});
