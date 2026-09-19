import type { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  allowedStatusTransitions,
  canTransitionStatus,
  claimDecision,
  isTerminalTicketStatus,
  ownerMutationDecision,
  statusMutationData,
  ticketStatuses,
  validateExpectedVersionBody,
  validateOwnerBody,
  validatePriorityBody,
  validateStatusBody,
} from "../../src/ticket-workflow.js";

describe("UNIT-03 Ticket workflow rules", () => {
  it("covers every allowed and forbidden edge in the complete 8x8 status matrix", () => {
    let allowed = 0;
    let forbidden = 0;
    for (const from of ticketStatuses) {
      for (const to of ticketStatuses) {
        const expected = allowedStatusTransitions[from].includes(to);
        expect(canTransitionStatus(from, to), `${from} -> ${to}`).toBe(expected);
        if (expected) allowed += 1;
        else forbidden += 1;
      }
      expect(canTransitionStatus(from, from), `${from} same-state`).toBe(false);
    }
    expect(allowed).toBe(17);
    expect(forbidden).toBe(47);
  });

  it.each([
    ["RESOLVED", { resolutionSummary: "x".repeat(10) }],
    ["RESOLVED", { resolutionSummary: "x".repeat(2_000) }],
    ["REOPENED", { reason: "x".repeat(5) }],
    ["REOPENED", { reason: "x".repeat(250) }],
    ["CANCELLED", { reason: "x".repeat(5) }],
    ["CANCELLED", { reason: "x".repeat(250) }],
  ] as const)("accepts trimmed inclusive boundaries for %s", (currentStatus, fields) => {
    const result = validateStatusBody({ currentStatus, expectedVersion: 1, ...fields });
    expect(result.input).toBeDefined();
    expect(result.fieldErrors).toEqual({});
  });

  it.each([
    ["RESOLVED", { resolutionSummary: "x".repeat(9) }, "resolutionSummary"],
    ["RESOLVED", { resolutionSummary: "x".repeat(2_001) }, "resolutionSummary"],
    ["REOPENED", { reason: "x".repeat(4) }, "reason"],
    ["REOPENED", { reason: "x".repeat(251) }, "reason"],
    ["CANCELLED", { reason: "x".repeat(4) }, "reason"],
    ["CANCELLED", { reason: "x".repeat(251) }, "reason"],
  ] as const)("rejects out-of-bound %s input", (currentStatus, fields, field) => {
    const result = validateStatusBody({ currentStatus, expectedVersion: 1, ...fields });
    expect(result.input).toBeUndefined();
    expect(result.fieldErrors[field]).toBeDefined();
  });

  it("trims required public text and counts JavaScript string units", () => {
    const resolved = validateStatusBody({
      currentStatus: "RESOLVED",
      expectedVersion: 1,
      resolutionSummary: `  ${"🙂".repeat(5)}  `,
    });
    expect(resolved.input?.resolutionSummary).toBe("🙂".repeat(5));
    expect(resolved.input?.resolutionSummary?.length).toBe(10);

    const reopened = validateStatusBody({
      currentStatus: "REOPENED",
      expectedVersion: 1,
      reason: "  valid reason  ",
    });
    expect(reopened.input?.reason).toBe("valid reason");
  });

  it("requires target-specific fields and rejects every irrelevant workflow field", () => {
    expect(validateStatusBody({ currentStatus: "RESOLVED", expectedVersion: 1 }).fieldErrors.resolutionSummary).toBeDefined();
    expect(validateStatusBody({ currentStatus: "REOPENED", expectedVersion: 1 }).fieldErrors.reason).toBeDefined();
    expect(validateStatusBody({ currentStatus: "CANCELLED", expectedVersion: 1 }).fieldErrors.reason).toBeDefined();
    expect(validateStatusBody({ currentStatus: "OPEN", expectedVersion: 1, reason: "not accepted" }).fieldErrors.reason).toBeDefined();
    expect(validateStatusBody({ currentStatus: "OPEN", expectedVersion: 1, resolutionSummary: "not accepted" }).fieldErrors.resolutionSummary).toBeDefined();
    expect(validateStatusBody({ currentStatus: "RESOLVED", expectedVersion: 1, resolutionSummary: "valid resolution", reason: "nope" }).fieldErrors.reason).toBeDefined();
    expect(validateStatusBody({ currentStatus: "CANCELLED", expectedVersion: 1, reason: "valid reason", resolutionSummary: "nope" }).fieldErrors.resolutionSummary).toBeDefined();
    expect(validateStatusBody({ currentStatus: "OPEN", expectedVersion: 1, actorId: 2 }).fieldErrors.actorId).toBeDefined();
  });

  it("validates bounded PostgreSQL integers, enums, JSON objects, and manual unassignment", () => {
    for (const expectedVersion of [0, -1, 2_147_483_648, Number.MAX_SAFE_INTEGER, 1.5, "1", null]) {
      expect(validateExpectedVersionBody({ expectedVersion }).fieldErrors.expectedVersion).toBeDefined();
    }
    expect(validateExpectedVersionBody({ expectedVersion: 2_147_483_647 }).input).toEqual({ expectedVersion: 2_147_483_647 });
    expect(validateExpectedVersionBody([]).fieldErrors.body).toBeDefined();
    expect(validateExpectedVersionBody({ expectedVersion: 1, ticketOwnerId: 2 }).fieldErrors.ticketOwnerId).toBeDefined();
    expect(validateOwnerBody({ ticketOwnerId: null, expectedVersion: 1 }).fieldErrors.ticketOwnerId).toBeDefined();
    expect(validateOwnerBody({ ticketOwnerId: 2_147_483_648, expectedVersion: 1 }).fieldErrors.ticketOwnerId).toBeDefined();
    expect(validateOwnerBody({ ticketOwnerId: 2, expectedVersion: 1, requesterId: 1 }).fieldErrors.requesterId).toBeDefined();
    expect(validatePriorityBody({ itPriority: "CRITICAL", expectedVersion: 1 }).fieldErrors.itPriority).toBeDefined();
    expect(validatePriorityBody({ itPriority: "URGENT", expectedVersion: 1 }).input).toEqual({ itPriority: "URGENT", expectedVersion: 1 });
    expect(validatePriorityBody({ itPriority: "URGENT", expectedVersion: 1, requestedPriority: "LOW" }).fieldErrors.requestedPriority).toBeDefined();
    expect(validateStatusBody({ currentStatus: "UNKNOWN", expectedVersion: 1 }).fieldErrors.currentStatus).toBeDefined();
  });

  it("models terminal restrictions and owner/claim no-op provenance decisions", () => {
    expect(ticketStatuses.filter(isTerminalTicketStatus)).toEqual(["CLOSED", "CANCELLED"]);
    expect(claimDecision(null, 10)).toBe("ASSIGNED");
    expect(claimDecision(10, 10)).toBe("NO_OP");
    expect(claimDecision(20, 10)).toBe("OWNER_CONFLICT");
    expect(ownerMutationDecision(null, 20)).toBe("ASSIGNED");
    expect(ownerMutationDecision(10, 20)).toBe("REASSIGNED");
    expect(ownerMutationDecision(20, 20)).toBe("NO_OP");
  });

  it("produces exact timestamp, reason, resolution and indication state changes", () => {
    const now = new Date("2026-09-19T01:02:03.000Z");
    expect(statusMutationData("RESOLVED", { resolutionSummary: "Resolved fully" }, now)).toMatchObject({
      currentStatus: "RESOLVED",
      resolutionSummary: "Resolved fully",
      resolvedAt: now,
      closedAt: null,
      lastStatusReason: null,
      version: { increment: 1 },
    });
    expect(statusMutationData("CLOSED", {}, now)).toMatchObject({ closedAt: now, lastStatusReason: null });
    expect(statusMutationData("REOPENED", { reason: "Issue returned" }, now)).toMatchObject({
      lastStatusReason: "Issue returned",
      resolutionSummary: null,
      resolvedAt: null,
      closedAt: null,
      requesterResolvedAt: null,
      requesterResolvedById: null,
    });
    expect(statusMutationData("CANCELLED", { reason: "No longer needed" }, now)).toMatchObject({ lastStatusReason: "No longer needed" });
    for (const target of ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER"] as TicketStatus[]) {
      expect(statusMutationData(target, {}, now).lastStatusReason).toBeNull();
    }
  });
});
