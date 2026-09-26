import type { Prisma, RequestedPriority, TicketStatus } from "@prisma/client";

export const STAFF_PRIORITY_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} as const satisfies Record<RequestedPriority, number>;

const priorities = Object.keys(STAFF_PRIORITY_RANK) as RequestedPriority[];
const statuses: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

export type QueueOwner = "all" | "unassigned" | "mine" | number;
export type QueueSortBy = "createdAt" | "updatedAt" | "ticketNumber" | "itPriority";

export function escapeLikeSearch(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export type StaffQueueQuery = {
  search: string;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: RequestedPriority | null;
  itPriority: RequestedPriority | null;
  currentStatus: TicketStatus | null;
  owner: QueueOwner;
  sortBy: QueueSortBy;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: 10 | 20 | 50;
};

const queueFields = new Set([
  "search",
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "itPriority",
  "currentStatus",
  "owner",
  "sortBy",
  "sortDirection",
  "page",
  "pageSize",
]);

export function parseStaffQueueQuery(query: Record<string, unknown>): {
  input?: StaffQueueQuery;
  fieldErrors: Record<string, string[]>;
} {
  const fieldErrors: Record<string, string[]> = {};

  for (const key of Object.keys(query)) {
    if (!queueFields.has(key)) fieldErrors[key] = ["This query parameter is not supported."];
  }

  const read = (field: string): string | undefined => {
    const value = query[field];
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      fieldErrors[field] = ["This query parameter must be provided once."];
      return undefined;
    }
    return value;
  };

  const search = read("search")?.trim() ?? "";
  if (search.length > 120) fieldErrors.search = ["Search must contain at most 120 characters."];

  const positiveId = (field: "categoryId" | "relatedSystemId"): number | null => {
    const value = read(field);
    if (value === undefined) return null;
    if (!/^[1-9]\d*$/.test(value)) {
      fieldErrors[field] = ["Must be a positive integer."];
      return null;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      fieldErrors[field] = ["Must be a safe positive integer."];
      return null;
    }
    return parsed;
  };

  const enumValue = <T extends string>(field: string, values: readonly T[], message: string): T | null => {
    const value = read(field);
    if (value === undefined) return null;
    if (!values.includes(value as T)) {
      fieldErrors[field] = [message];
      return null;
    }
    return value as T;
  };

  const categoryId = positiveId("categoryId");
  const relatedSystemId = positiveId("relatedSystemId");
  const requestedPriority = enumValue("requestedPriority", priorities, "Requested priority is invalid.");
  const itPriority = enumValue("itPriority", priorities, "IT priority is invalid.");
  const currentStatus = enumValue("currentStatus", statuses, "Current status is invalid.");

  const ownerValue = read("owner");
  let owner: QueueOwner = "all";
  if (ownerValue !== undefined) {
    if (["all", "unassigned", "mine"].includes(ownerValue)) owner = ownerValue as QueueOwner;
    else if (/^[1-9]\d*$/.test(ownerValue) && Number.isSafeInteger(Number(ownerValue))) owner = Number(ownerValue);
    else fieldErrors.owner = ["Owner must be all, unassigned, mine, or a positive safe user ID."];
  }

  const sortByValue = read("sortBy");
  const sortBy = sortByValue === undefined
    ? "updatedAt"
    : ["createdAt", "updatedAt", "ticketNumber", "itPriority"].includes(sortByValue)
      ? sortByValue as QueueSortBy
      : null;
  if (sortByValue !== undefined && sortBy === null) fieldErrors.sortBy = ["Sort field is invalid."];

  const sortDirectionValue = read("sortDirection");
  const sortDirection = sortDirectionValue === undefined
    ? "desc"
    : sortDirectionValue === "asc" || sortDirectionValue === "desc"
      ? sortDirectionValue
      : null;
  if (sortDirectionValue !== undefined && sortDirection === null) fieldErrors.sortDirection = ["Sort direction is invalid."];

  const pageValue = read("page");
  let page = 1;
  if (pageValue !== undefined) {
    if (!/^[1-9]\d*$/.test(pageValue) || !Number.isSafeInteger(Number(pageValue))) {
      fieldErrors.page = ["Page must be a safe positive integer."];
    } else page = Number(pageValue);
  }

  const pageSizeValue = read("pageSize");
  let pageSize: 10 | 20 | 50 = 10;
  if (pageSizeValue !== undefined) {
    if (pageSizeValue !== "10" && pageSizeValue !== "20" && pageSizeValue !== "50") {
      fieldErrors.pageSize = ["Page size must be 10, 20, or 50."];
    } else pageSize = Number(pageSizeValue) as 10 | 20 | 50;
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) fieldErrors.page = ["Pagination offset must be a safe integer."];

  if (Object.keys(fieldErrors).length || sortBy === null || sortDirection === null) return { fieldErrors };
  return {
    fieldErrors,
    input: {
      search,
      categoryId,
      relatedSystemId,
      requestedPriority,
      itPriority,
      currentStatus,
      owner,
      sortBy,
      sortDirection,
      page,
      pageSize,
    },
  };
}

export function staffQueueOrderBy(input: Pick<StaffQueueQuery, "sortBy" | "sortDirection">): Prisma.TicketOrderByWithRelationInput[] {
  const direction = input.sortDirection;
  if (input.sortBy === "itPriority") {
    // PostgreSQL follows RequestedPriority's declared enum order: LOW, MEDIUM, HIGH, URGENT.
    return [{ itPriority: direction }, { updatedAt: direction }, { id: direction }];
  }
  return [{ [input.sortBy]: direction }, { id: direction }];
}
