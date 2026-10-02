import { describe, expect, it } from "vitest";
import { escapeLikeSearch, parseStaffQueueQuery, STAFF_PRIORITY_RANK, staffQueueOrderBy } from "../../src/queue-query.js";

describe("UNIT-04 staff queue query", () => {
  it("applies every default and normalizes trimmed search and numeric IDs", () => {
    expect(parseStaffQueueQuery({})).toEqual({
      fieldErrors: {},
      input: {
        search: "",
        categoryId: null,
        relatedSystemId: null,
        requestedPriority: null,
        itPriority: null,
        currentStatus: null,
        owner: "all",
        sortBy: "updatedAt",
        sortDirection: "desc",
        page: 1,
        pageSize: 10,
      },
    });

    expect(parseStaffQueueQuery({ search: "  TKT-59  ", categoryId: "12", relatedSystemId: "3", owner: "42" }).input)
      .toMatchObject({ search: "TKT-59", categoryId: 12, relatedSystemId: 3, owner: 42 });
  });

  it("fixes priority rank and deterministic order rules", () => {
    expect(STAFF_PRIORITY_RANK).toEqual({ LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 });
    expect(staffQueueOrderBy({ sortBy: "itPriority", sortDirection: "desc" })).toEqual([
      { itPriority: "desc" }, { updatedAt: "desc" }, { id: "desc" },
    ]);
    expect(staffQueueOrderBy({ sortBy: "itPriority", sortDirection: "asc" })).toEqual([
      { itPriority: "asc" }, { updatedAt: "asc" }, { id: "asc" },
    ]);
    expect(staffQueueOrderBy({ sortBy: "ticketNumber", sortDirection: "asc" })).toEqual([
      { ticketNumber: "asc" }, { id: "asc" },
    ]);
  });

  it("escapes PostgreSQL LIKE wildcard characters so queue search remains literal", () => {
    expect(escapeLikeSearch("100%_ready\\path")).toBe("100\\%\\_ready\\\\path");
  });

  it.each([
    [{ unexpected: "value" }, "unexpected"],
    [{ search: ["one", "two"] }, "search"],
    [{ categoryId: "0" }, "categoryId"],
    [{ relatedSystemId: "9007199254740992" }, "relatedSystemId"],
    [{ requestedPriority: "CRITICAL" }, "requestedPriority"],
    [{ itPriority: "CRITICAL" }, "itPriority"],
    [{ currentStatus: "DONE" }, "currentStatus"],
    [{ owner: "requester" }, "owner"],
    [{ sortBy: "summary" }, "sortBy"],
    [{ sortDirection: "sideways" }, "sortDirection"],
    [{ page: "0" }, "page"],
    [{ pageSize: "25" }, "pageSize"],
    [{ search: "x".repeat(121) }, "search"],
  ])("rejects malformed, unknown, repeated, or out-of-range input %#", (query, field) => {
    const parsed = parseStaffQueueQuery(query);
    expect(parsed.input).toBeUndefined();
    expect(parsed.fieldErrors[field]).toBeDefined();
  });

  it("rejects a safe page whose computed offset would be unsafe", () => {
    const parsed = parseStaffQueueQuery({ page: String(Number.MAX_SAFE_INTEGER), pageSize: "50" });
    expect(parsed.input).toBeUndefined();
    expect(parsed.fieldErrors.page).toEqual(["Pagination offset must be a safe integer."]);
  });
});
