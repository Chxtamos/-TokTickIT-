import { createHash } from "node:crypto";
import {
  Prisma,
  type ActionTakenStatus,
  type PrismaClient,
  type UserRole,
} from "@prisma/client";

export type ActionsPrisma = Pick<
  PrismaClient,
  "ticket" | "requesterUser" | "actionTaken" | "actionTakenEvent" | "$transaction" | "$queryRaw"
>;

export const actionStatuses: ActionTakenStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const operationalRoles: UserRole[] = ["IT_STAFF", "ADMINISTRATOR"];
const createFields = new Set([
  "clientRequestId", "description", "result", "assigneeId",
  "followUpRequired", "followUpNote", "attachmentNotes",
]);
const updateFields = new Set([
  "description", "result", "assigneeId", "followUpRequired",
  "followUpNote", "attachmentNotes", "status", "expectedVersion",
]);

export type ActionDto = {
  id: number;
  ticketId: number;
  workflowCycle: number;
  description: string;
  result: string | null;
  performedBy: { id: number; name: string };
  assignee: { id: number; name: string } | null;
  status: ActionTakenStatus;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export const actionSelect = {
  id: true,
  ticketId: true,
  workflowCycle: true,
  description: true,
  result: true,
  performedBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  status: true,
  followUpRequired: true,
  followUpNote: true,
  attachmentNotes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ActionTakenSelect;

export class ActionTakenError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type CreateInput = {
  clientRequestId: string;
  description: string;
  result: string | null;
  assigneeId: number | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

type UpdateInput = {
  expectedVersion: number;
  description?: string;
  result?: string | null;
  assigneeId?: number | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  status?: ActionTakenStatus;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function optionalText(
  raw: Record<string, unknown>,
  field: string,
  max: number,
  fieldErrors: Record<string, string[]>,
): string | null {
  const value = raw[field];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors[field] = ["Must be text or null."];
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    fieldErrors[field] = [`Must contain 1 to ${max.toLocaleString("en-US")} characters when provided.`];
    return null;
  }
  return trimmed;
}

function validateDescription(value: unknown, fieldErrors: Record<string, string[]>) {
  const description = typeof value === "string" ? value.trim() : "";
  if (description.length < 5 || description.length > 2000) {
    fieldErrors.description = ["Description must contain 5 to 2,000 characters."];
  }
  return description;
}

function validateAssignee(value: unknown, fieldErrors: Record<string, string[]>) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    fieldErrors.assigneeId = ["Assignee ID must be a positive PostgreSQL integer or null."];
    return null;
  }
  return value;
}

function validateFollowUp(
  followUpRequired: unknown,
  followUpNoteRaw: unknown,
  fieldErrors: Record<string, string[]>,
) {
  if (typeof followUpRequired !== "boolean") {
    fieldErrors.followUpRequired = ["Follow-up required must be true or false."];
    return { required: false, note: null as string | null };
  }
  if (followUpRequired) {
    const note = typeof followUpNoteRaw === "string" ? followUpNoteRaw.trim() : "";
    if (note.length < 5 || note.length > 1000) {
      fieldErrors.followUpNote = ["Follow-up note must contain 5 to 1,000 characters when follow-up is required."];
    }
    return { required: true, note: note || null };
  }
  if (typeof followUpNoteRaw === "string" && followUpNoteRaw.trim().length > 0) {
    fieldErrors.followUpNote = ["Follow-up note must be null or omitted when follow-up is not required."];
  } else if (followUpNoteRaw !== undefined && followUpNoteRaw !== null && followUpNoteRaw !== "") {
    fieldErrors.followUpNote = ["Follow-up note must be text or null."];
  }
  return { required: false, note: null as string | null };
}

export function validateActionCreateBody(body: unknown): { input?: CreateInput; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  }
  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (!createFields.has(key)) fieldErrors[key] = ["This field is not supported."];

  if (!isUuid(raw.clientRequestId)) fieldErrors.clientRequestId = ["clientRequestId must be a valid UUID."];
  const description = validateDescription(raw.description, fieldErrors);
  const result = optionalText(raw, "result", 2000, fieldErrors);
  const assigneeId = validateAssignee(raw.assigneeId, fieldErrors);
  const followUp = validateFollowUp(raw.followUpRequired, raw.followUpNote, fieldErrors);
  const attachmentNotes = optionalText(raw, "attachmentNotes", 1000, fieldErrors);

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    fieldErrors,
    input: {
      clientRequestId: raw.clientRequestId as string,
      description,
      result,
      assigneeId,
      followUpRequired: followUp.required,
      followUpNote: followUp.note,
      attachmentNotes,
    },
  };
}

export function validateActionUpdateBody(body: unknown): { input?: UpdateInput; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  }
  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (!updateFields.has(key)) fieldErrors[key] = ["This field is not supported."];
  const expectedVersion = raw.expectedVersion;
  if (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) {
    fieldErrors.expectedVersion = ["Expected version must be a positive integer."];
  }
  const mutableKeys = Object.keys(raw).filter((key) => key !== "expectedVersion");
  if (mutableKeys.length === 0) fieldErrors.body = ["At least one editable Action field is required."];

  const input: UpdateInput = { expectedVersion: expectedVersion as number };
  if ("description" in raw) input.description = validateDescription(raw.description, fieldErrors);
  if ("result" in raw) input.result = optionalText(raw, "result", 2000, fieldErrors);
  if ("assigneeId" in raw) input.assigneeId = validateAssignee(raw.assigneeId, fieldErrors);
  if ("attachmentNotes" in raw) input.attachmentNotes = optionalText(raw, "attachmentNotes", 1000, fieldErrors);
  if ("status" in raw) {
    if (!actionStatuses.includes(raw.status as ActionTakenStatus)) fieldErrors.status = ["Action status is invalid."];
    else input.status = raw.status as ActionTakenStatus;
  }

  if ("followUpRequired" in raw || "followUpNote" in raw) {
    if (!("followUpRequired" in raw)) {
      fieldErrors.followUpRequired = ["followUpRequired is required when changing followUpNote."];
    } else {
      const followUp = validateFollowUp(raw.followUpRequired, raw.followUpNote, fieldErrors);
      input.followUpRequired = followUp.required;
      input.followUpNote = followUp.note;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input, fieldErrors };
}

function payloadHash(input: CreateInput): string {
  return createHash("sha256").update(JSON.stringify({
    description: input.description,
    result: input.result,
    assigneeId: input.assigneeId,
    followUpRequired: input.followUpRequired,
    followUpNote: input.followUpNote,
    attachmentNotes: input.attachmentNotes,
  })).digest("hex");
}

async function requireEligibleAssignee(tx: Prisma.TransactionClient, assigneeId: number | null | undefined) {
  if (assigneeId === null || assigneeId === undefined) return;
  const assignee = await tx.requesterUser.findFirst({
    where: { id: assigneeId, isActive: true, role: { in: operationalRoles } },
    select: { id: true },
  });
  if (!assignee) throw new ActionTakenError("ASSIGNEE_INELIGIBLE");
}

export async function listActions(
  prisma: ActionsPrisma,
  actor: { id: number; role: UserRole },
  ticketId: number,
): Promise<ActionDto[]> {
  const ticket = await prisma.ticket.findFirst({
    where: actor.role === "REQUESTER" ? { id: ticketId, requesterId: actor.id } : { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw new ActionTakenError("RESOURCE_NOT_FOUND");
  return prisma.actionTaken.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: actionSelect,
  }) as Promise<ActionDto[]>;
}

export async function createAction(
  prisma: ActionsPrisma,
  actorId: number,
  ticketId: number,
  input: CreateInput,
): Promise<{ item: ActionDto; replayed: boolean }> {
  const hash = payloadHash(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const actor = await tx.requesterUser.findFirst({
        where: { id: actorId, isActive: true, role: { in: operationalRoles } },
        select: { id: true },
      });
      if (!actor) throw new ActionTakenError("ROLE_FORBIDDEN");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`);
      const ticket = await tx.ticket.findFirst({ where: { id: ticketId }, select: { id: true, workflowCycle: true } });
      if (!ticket) throw new ActionTakenError("RESOURCE_NOT_FOUND");

      const existing = await tx.actionTaken.findUnique({
        where: { ticketId_clientRequestId: { ticketId, clientRequestId: input.clientRequestId } },
        select: { ...actionSelect, requestPayloadHash: true },
      });
      if (existing) {
        if (existing.requestPayloadHash !== hash) throw new ActionTakenError("IDEMPOTENCY_CONFLICT");
        const { requestPayloadHash: _hash, ...item } = existing;
        return { item: item as ActionDto, replayed: true };
      }

      await requireEligibleAssignee(tx, input.assigneeId);
      const item = await tx.actionTaken.create({
        data: {
          ticketId,
          workflowCycle: ticket.workflowCycle,
          performedById: actorId,
          assigneeId: input.assigneeId,
          description: input.description,
          result: input.result,
          followUpRequired: input.followUpRequired,
          followUpNote: input.followUpNote,
          attachmentNotes: input.attachmentNotes,
          status: "PENDING",
          clientRequestId: input.clientRequestId,
          requestPayloadHash: hash,
          version: 1,
        },
        select: actionSelect,
      });
      await tx.actionTakenEvent.create({
        data: {
          actionId: item.id,
          actorId,
          eventType: "CREATED",
          resultingVersion: 1,
          changedFields: ["description", "result", "assigneeId", "followUpRequired", "followUpNote", "attachmentNotes", "status"],
          toStatus: "PENDING",
          nextAssigneeId: input.assigneeId,
        },
      });
      return { item: item as ActionDto, replayed: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.actionTaken.findUnique({
        where: { ticketId_clientRequestId: { ticketId, clientRequestId: input.clientRequestId } },
        select: { ...actionSelect, requestPayloadHash: true },
      });
      if (existing && existing.requestPayloadHash === hash) {
        const { requestPayloadHash: _hash, ...item } = existing;
        return { item: item as ActionDto, replayed: true };
      }
      if (existing) throw new ActionTakenError("IDEMPOTENCY_CONFLICT");
    }
    throw error;
  }
}

const transitions: Record<ActionTakenStatus, ActionTakenStatus[]> = {
  PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateAction(
  prisma: ActionsPrisma,
  actorId: number,
  ticketId: number,
  actionId: number,
  input: UpdateInput,
): Promise<ActionDto> {
  return prisma.$transaction(async (tx) => {
    const actor = await tx.requesterUser.findFirst({
      where: { id: actorId, isActive: true, role: { in: operationalRoles } },
      select: { id: true },
    });
    if (!actor) throw new ActionTakenError("ROLE_FORBIDDEN");
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`);
    const ticket = await tx.ticket.findFirst({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) throw new ActionTakenError("RESOURCE_NOT_FOUND");
    const current = await tx.actionTaken.findFirst({
      where: { id: actionId, ticketId },
      select: {
        id: true, version: true, status: true, description: true, result: true,
        assigneeId: true, followUpRequired: true, followUpNote: true, attachmentNotes: true,
      },
    });
    if (!current) throw new ActionTakenError("RESOURCE_NOT_FOUND");
    if (current.version !== input.expectedVersion) throw new ActionTakenError("VERSION_CONFLICT");
    if (current.status === "COMPLETED" || current.status === "CANCELLED") throw new ActionTakenError("ACTION_TERMINAL");
    if (input.status && input.status !== current.status && !transitions[current.status].includes(input.status)) {
      throw new ActionTakenError("ACTION_TRANSITION_INVALID");
    }
    if (input.status === current.status) throw new ActionTakenError("ACTION_TRANSITION_INVALID");
    if ("assigneeId" in input) await requireEligibleAssignee(tx, input.assigneeId);

    const next = {
      description: input.description ?? current.description,
      result: "result" in input ? input.result ?? null : current.result,
      assigneeId: "assigneeId" in input ? input.assigneeId ?? null : current.assigneeId,
      followUpRequired: input.followUpRequired ?? current.followUpRequired,
      followUpNote: "followUpNote" in input ? input.followUpNote ?? null : current.followUpNote,
      attachmentNotes: "attachmentNotes" in input ? input.attachmentNotes ?? null : current.attachmentNotes,
      status: input.status ?? current.status,
    };
    if (next.followUpRequired) {
      const note = next.followUpNote?.trim() ?? "";
      if (note.length < 5 || note.length > 1000) throw new ActionTakenError("FOLLOW_UP_INVALID");
    } else {
      next.followUpNote = null;
    }
    if (next.status === "COMPLETED") {
      const result = next.result?.trim() ?? "";
      if (result.length < 5 || result.length > 2000 || next.followUpRequired) throw new ActionTakenError("COMPLETION_INVALID");
    }

    const changedFields = (Object.keys(next) as Array<keyof typeof next>).filter((field) => next[field] !== current[field as keyof typeof current]);
    if (changedFields.length === 0) return tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect }) as Promise<ActionDto>;

    const updated = await tx.actionTaken.updateMany({
      where: { id: actionId, ticketId, version: input.expectedVersion },
      data: { ...next, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new ActionTakenError("VERSION_CONFLICT");
    const resultingVersion = input.expectedVersion + 1;
    const eventType = next.status !== current.status ? "STATUS_CHANGED" : next.assigneeId !== current.assigneeId ? "ASSIGNED" : "UPDATED";
    await tx.actionTakenEvent.create({
      data: {
        actionId,
        actorId,
        eventType,
        resultingVersion,
        changedFields,
        fromStatus: next.status !== current.status ? current.status : null,
        toStatus: next.status !== current.status ? next.status : null,
        previousAssigneeId: next.assigneeId !== current.assigneeId ? current.assigneeId : null,
        nextAssigneeId: next.assigneeId !== current.assigneeId ? next.assigneeId : null,
      },
    });
    return tx.actionTaken.findUniqueOrThrow({ where: { id: actionId }, select: actionSelect }) as Promise<ActionDto>;
  });
}
