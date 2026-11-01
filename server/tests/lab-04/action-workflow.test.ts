import { describe, expect, it, vi } from "vitest";
import { ActionTakenError, listActions, updateAction } from "../../src/actions-taken.js";

function currentAction(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" = "IN_PROGRESS") {
  return {
    id: 7,
    version: 1,
    status,
    description: "Current Action description.",
    result: null,
    assigneeId: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
  };
}

function updatePrisma(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" = "IN_PROGRESS") {
  const tx = {
    requesterUser: { findFirst: vi.fn().mockResolvedValue({ id: 5 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: 42 }]),
    ticket: { findFirst: vi.fn().mockResolvedValue({ id: 42 }) },
    actionTaken: {
      findFirst: vi.fn().mockResolvedValue(currentAction(status)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn(),
    },
    actionTakenEvent: { create: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (callback: (inner: typeof tx) => unknown) => callback(tx)) },
  };
}

describe("Lab 4 Action workflow helpers", () => {
  it("requests stable oldest-first history ordering", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      ticket: { findFirst: vi.fn().mockResolvedValue({ id: 42 }) },
      actionTaken: { findMany },
    };
    await listActions(prisma as never, { id: 5, role: "IT_STAFF" }, 42);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticketId: 42 },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }));
  });

  it("rejects backwards and same-state Action transitions before mutation", async () => {
    const backwards = updatePrisma("IN_PROGRESS");
    await expect(updateAction(backwards.prisma as never, 5, 42, 7, {
      expectedVersion: 1,
      status: "PENDING",
    })).rejects.toMatchObject({ code: "ACTION_TRANSITION_INVALID" } satisfies Partial<ActionTakenError>);
    expect(backwards.tx.actionTaken.updateMany).not.toHaveBeenCalled();

    const sameState = updatePrisma("PENDING");
    await expect(updateAction(sameState.prisma as never, 5, 42, 7, {
      expectedVersion: 1,
      status: "PENDING",
    })).rejects.toMatchObject({ code: "ACTION_TRANSITION_INVALID" } satisfies Partial<ActionTakenError>);
    expect(sameState.tx.actionTaken.updateMany).not.toHaveBeenCalled();
  });

  it("requires a valid Result and no outstanding follow-up before completion", async () => {
    const missingResult = updatePrisma("IN_PROGRESS");
    await expect(updateAction(missingResult.prisma as never, 5, 42, 7, {
      expectedVersion: 1,
      status: "COMPLETED",
    })).rejects.toMatchObject({ code: "COMPLETION_INVALID" } satisfies Partial<ActionTakenError>);
    expect(missingResult.tx.actionTaken.updateMany).not.toHaveBeenCalled();

    const followUp = updatePrisma("IN_PROGRESS");
    followUp.tx.actionTaken.findFirst.mockResolvedValue({
      ...currentAction("IN_PROGRESS"),
      result: "Valid completion result.",
      followUpRequired: true,
      followUpNote: "Still requires follow-up.",
    });
    await expect(updateAction(followUp.prisma as never, 5, 42, 7, {
      expectedVersion: 1,
      status: "COMPLETED",
    })).rejects.toMatchObject({ code: "COMPLETION_INVALID" } satisfies Partial<ActionTakenError>);
    expect(followUp.tx.actionTaken.updateMany).not.toHaveBeenCalled();
  });
});
