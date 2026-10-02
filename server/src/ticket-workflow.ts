import type { RequestedPriority, TicketStatus } from "@prisma/client";

export const ticketStatuses: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

export const ticketPriorities: readonly RequestedPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

export const allowedStatusTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  CANCELLED: [],
};

export type FieldErrors = Record<string, string[]>;

export type StatusMutationInput = {
  currentStatus: TicketStatus;
  expectedVersion: number;
  resolutionSummary?: string;
  reason?: string;
};

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function isPostgresPositiveInteger(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value > 0
    && value <= POSTGRES_INTEGER_MAX;
}

function objectBody(body: unknown): Record<string, unknown> | null {
  return body !== null && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

function rejectUnknownFields(
  raw: Record<string, unknown>,
  supported: ReadonlySet<string>,
  fieldErrors: FieldErrors,
) {
  for (const key of Object.keys(raw)) {
    if (!supported.has(key)) fieldErrors[key] = ["This field is not supported."];
  }
}

function validateExpectedVersion(raw: Record<string, unknown>, fieldErrors: FieldErrors) {
  if (!isPostgresPositiveInteger(raw.expectedVersion)) {
    fieldErrors.expectedVersion = ["Expected version must be a positive PostgreSQL integer."];
  }
}

export function validateExpectedVersionBody(body: unknown): {
  input?: { expectedVersion: number };
  fieldErrors: FieldErrors;
} {
  const raw = objectBody(body);
  if (!raw) return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  const fieldErrors: FieldErrors = {};
  rejectUnknownFields(raw, new Set(["expectedVersion"]), fieldErrors);
  validateExpectedVersion(raw, fieldErrors);
  return Object.keys(fieldErrors).length
    ? { fieldErrors }
    : { input: { expectedVersion: raw.expectedVersion as number }, fieldErrors };
}

export function validateOwnerBody(body: unknown): {
  input?: { ticketOwnerId: number; expectedVersion: number };
  fieldErrors: FieldErrors;
} {
  const raw = objectBody(body);
  if (!raw) return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  const fieldErrors: FieldErrors = {};
  rejectUnknownFields(raw, new Set(["ticketOwnerId", "expectedVersion"]), fieldErrors);
  if (!isPostgresPositiveInteger(raw.ticketOwnerId)) {
    fieldErrors.ticketOwnerId = ["Ticket owner ID must be a positive PostgreSQL integer; manual unassignment is not supported."];
  }
  validateExpectedVersion(raw, fieldErrors);
  return Object.keys(fieldErrors).length
    ? { fieldErrors }
    : {
        input: {
          ticketOwnerId: raw.ticketOwnerId as number,
          expectedVersion: raw.expectedVersion as number,
        },
        fieldErrors,
      };
}

export function validatePriorityBody(body: unknown): {
  input?: { itPriority: RequestedPriority; expectedVersion: number };
  fieldErrors: FieldErrors;
} {
  const raw = objectBody(body);
  if (!raw) return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  const fieldErrors: FieldErrors = {};
  rejectUnknownFields(raw, new Set(["itPriority", "expectedVersion"]), fieldErrors);
  if (!ticketPriorities.includes(raw.itPriority as RequestedPriority)) {
    fieldErrors.itPriority = ["IT Priority must be LOW, MEDIUM, HIGH, or URGENT."];
  }
  validateExpectedVersion(raw, fieldErrors);
  return Object.keys(fieldErrors).length
    ? { fieldErrors }
    : {
        input: {
          itPriority: raw.itPriority as RequestedPriority,
          expectedVersion: raw.expectedVersion as number,
        },
        fieldErrors,
      };
}

export function validateStatusBody(body: unknown): {
  input?: StatusMutationInput;
  fieldErrors: FieldErrors;
} {
  const raw = objectBody(body);
  if (!raw) return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  const fieldErrors: FieldErrors = {};
  rejectUnknownFields(raw, new Set(["currentStatus", "expectedVersion", "resolutionSummary", "reason"]), fieldErrors);
  validateExpectedVersion(raw, fieldErrors);

  const target = raw.currentStatus as TicketStatus;
  if (!ticketStatuses.includes(target)) {
    fieldErrors.currentStatus = ["Current status is invalid."];
  }

  const hasResolution = Object.prototype.hasOwnProperty.call(raw, "resolutionSummary");
  const hasReason = Object.prototype.hasOwnProperty.call(raw, "reason");
  let resolutionSummary: string | undefined;
  let reason: string | undefined;

  if (target === "RESOLVED") {
    resolutionSummary = typeof raw.resolutionSummary === "string" ? raw.resolutionSummary.trim() : "";
    if (resolutionSummary.length < 10 || resolutionSummary.length > 2_000) {
      fieldErrors.resolutionSummary = ["Resolution summary must contain 10 to 2,000 characters."];
    }
    if (hasReason) fieldErrors.reason = ["Reason is only supported when reopening or cancelling a Ticket."];
  } else if (target === "REOPENED" || target === "CANCELLED") {
    reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
    if (reason.length < 5 || reason.length > 250) {
      fieldErrors.reason = ["Reason must contain 5 to 250 characters."];
    }
    if (hasResolution) fieldErrors.resolutionSummary = ["Resolution summary is only supported when resolving a Ticket."];
  } else if (ticketStatuses.includes(target)) {
    if (hasResolution) fieldErrors.resolutionSummary = ["Resolution summary is only supported when resolving a Ticket."];
    if (hasReason) fieldErrors.reason = ["Reason is only supported when reopening or cancelling a Ticket."];
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return {
    input: {
      currentStatus: target,
      expectedVersion: raw.expectedVersion as number,
      ...(resolutionSummary !== undefined ? { resolutionSummary } : {}),
      ...(reason !== undefined ? { reason } : {}),
    },
    fieldErrors,
  };
}

export function isTerminalTicketStatus(status: TicketStatus): boolean {
  return status === "CLOSED" || status === "CANCELLED";
}

export function canTransitionStatus(from: TicketStatus, to: TicketStatus): boolean {
  return allowedStatusTransitions[from].includes(to);
}

export type OwnerMutationDecision = "NO_OP" | "ASSIGNED" | "REASSIGNED";

export function ownerMutationDecision(
  currentOwnerId: number | null,
  targetOwnerId: number,
): OwnerMutationDecision {
  if (currentOwnerId === targetOwnerId) return "NO_OP";
  return currentOwnerId === null ? "ASSIGNED" : "REASSIGNED";
}

export type ClaimDecision = "NO_OP" | "ASSIGNED" | "OWNER_CONFLICT";

export function claimDecision(currentOwnerId: number | null, actorId: number): ClaimDecision {
  if (currentOwnerId === actorId) return "NO_OP";
  return currentOwnerId === null ? "ASSIGNED" : "OWNER_CONFLICT";
}

export function statusMutationData(
  target: TicketStatus,
  input: Pick<StatusMutationInput, "resolutionSummary" | "reason">,
  now: Date,
): Record<string, unknown> {
  const common = {
    currentStatus: target,
    version: { increment: 1 },
    updatedAt: now,
  };
  if (target === "RESOLVED") {
    return {
      ...common,
      resolutionSummary: input.resolutionSummary,
      resolvedAt: now,
      closedAt: null,
      lastStatusReason: null,
    };
  }
  if (target === "CLOSED") {
    return { ...common, closedAt: now, lastStatusReason: null };
  }
  if (target === "REOPENED") {
    return {
      ...common,
      lastStatusReason: input.reason,
      resolutionSummary: null,
      resolvedAt: null,
      closedAt: null,
      requesterResolvedAt: null,
      requesterResolvedById: null,
    };
  }
  if (target === "CANCELLED") {
    return { ...common, lastStatusReason: input.reason };
  }
  return { ...common, lastStatusReason: null };
}
