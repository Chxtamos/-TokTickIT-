import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import { csrfToken, requesterUser } from "../auth-fixtures.js";

afterEach(() => { vi.unstubAllGlobals(); api.clearInMemoryAuth(); });

describe("Lab 3 authenticated Requester API regression", () => {
  it("uses cookie credentials on every request, in-memory CSRF on writes, and no requester identity header", async () => {
    const removed: api.TicketAttachmentMetadata = { id: 4, originalName: "evidence.pdf", mimeType: "application/pdf", sizeBytes: 4, state: "REMOVED", uploadedAt: "2026-09-01T00:00:00.000Z", removedAt: "2026-09-01T01:00:00.000Z", removedReason: "No longer needed", downloadUrl: null };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return new Response(JSON.stringify({ user: requesterUser, csrfToken }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/tickets") && (!init?.method || init.method === "GET")) return new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, applied: { search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc" } }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/tickets") ) return new Response(JSON.stringify({ ticket: { id: 5, ticketNumber: "TKT-2026-000005" }, replayed: false }), { status: 201, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/attachments")) return new Response(JSON.stringify({ ...removed, state: "ACTIVE", removedAt: null, removedReason: null, downloadUrl: "/download" }), { status: 201, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify(removed), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.getCurrentUser();
    await api.getTickets({ search: "", categoryId: null, relatedSystemId: null, requestedPriority: null, currentStatus: null, sortBy: "updatedAt", sortDirection: "desc", page: 1, pageSize: 10 });
    await api.createTicket({ clientRequestId: "123e4567-e89b-42d3-a456-426614174000", categoryId: 1, relatedSystemId: 2, summary: "Valid summary", requestedPriority: "MEDIUM", description: "A sufficiently detailed description." });
    await api.uploadTicketAttachment(5, new File(["test"], "evidence.pdf", { type: "application/pdf" }));
    await api.removeTicketAttachment(5, 4, "No longer needed");

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe("include");
      const headers = new Headers(init?.headers);
      expect(headers.has("X-Requester-Id")).toBe(false);
    }
    for (const index of [2, 3, 4]) expect(new Headers(fetchMock.mock.calls[index][1]?.headers).get("X-CSRF-Token")).toBe(csrfToken);
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).has("X-CSRF-Token")).toBe(false);
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("requesterId");
    expect(String(fetchMock.mock.calls[2][1]?.body)).not.toContain("requesterId");
  });

  it("does not treat CURRENT_PASSWORD_INVALID as a revoked session", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: requesterUser, csrfToken }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "CURRENT_PASSWORD_INVALID", message: "Current password is invalid." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const sessionInvalid = vi.fn();
    window.addEventListener("toktickit:session-invalid", sessionInvalid);
    try {
      await api.getCurrentUser();
      await expect(api.changePassword("wrong current password", "a valid replacement password", "a valid replacement password")).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INVALID", statusCode: 401 });
      expect(sessionInvalid).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("toktickit:session-invalid", sessionInvalid);
    }
  });
});
