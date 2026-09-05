import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevelopmentRequesters } from "../../src/api.js";

afterEach(() => vi.restoreAllMocks());

describe("Development Requester API client", () => {
  it("rejects malformed Requester response items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: 0, name: "Invalid ID" },
      { id: 2, name: "" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(getDevelopmentRequesters()).rejects.toThrow("invalid Requester response");
  });

  it("accepts positive safe IDs and non-empty names", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: 1, name: "Alice Requester" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(getDevelopmentRequesters()).resolves.toEqual([{ id: 1, name: "Alice Requester" }]);
  });
});
