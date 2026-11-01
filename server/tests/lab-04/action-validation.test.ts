import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateActionCreateBody, validateActionUpdateBody } from "../../src/actions-taken.js";

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    description: "Valid Action description.",
    result: null,
    assigneeId: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    ...overrides,
  };
}

describe("Lab 4 Action validation boundaries", () => {
  it("enforces description, optional-result and attachment boundaries", () => {
    expect(validateActionCreateBody(createBody({ description: "1234" })).fieldErrors.description).toBeDefined();
    expect(validateActionCreateBody(createBody({ description: "12345" })).input?.description).toBe("12345");
    expect(validateActionCreateBody(createBody({ result: "x".repeat(2000) })).input?.result).toHaveLength(2000);
    expect(validateActionCreateBody(createBody({ result: "x".repeat(2001) })).fieldErrors.result).toBeDefined();
    expect(validateActionCreateBody(createBody({ attachmentNotes: "x".repeat(1000) })).input?.attachmentNotes).toHaveLength(1000);
    expect(validateActionCreateBody(createBody({ attachmentNotes: "x".repeat(1001) })).fieldErrors.attachmentNotes).toBeDefined();
  });

  it("enforces conditional follow-up note boundaries exactly", () => {
    expect(validateActionCreateBody(createBody({ followUpRequired: true, followUpNote: "1234" })).fieldErrors.followUpNote).toBeDefined();
    expect(validateActionCreateBody(createBody({ followUpRequired: true, followUpNote: "12345" })).input).toMatchObject({
      followUpRequired: true,
      followUpNote: "12345",
    });
    expect(validateActionCreateBody(createBody({ followUpRequired: true, followUpNote: "x".repeat(1001) })).fieldErrors.followUpNote).toBeDefined();
    expect(validateActionCreateBody(createBody({ followUpRequired: false, followUpNote: "not allowed" })).fieldErrors.followUpNote).toBeDefined();
  });

  it("requires a positive expectedVersion and explicit follow-up flag on update", () => {
    expect(validateActionUpdateBody({ expectedVersion: 0, description: "Valid description." }).fieldErrors.expectedVersion).toBeDefined();
    expect(validateActionUpdateBody({ expectedVersion: 1 }).fieldErrors.body).toBeDefined();
    expect(validateActionUpdateBody({ expectedVersion: 1, followUpNote: "Valid note" }).fieldErrors.followUpRequired).toBeDefined();
    expect(validateActionUpdateBody({
      expectedVersion: 1,
      followUpRequired: true,
      followUpNote: "Valid note",
    }).input).toMatchObject({
      expectedVersion: 1,
      followUpRequired: true,
      followUpNote: "Valid note",
    });
  });
});
