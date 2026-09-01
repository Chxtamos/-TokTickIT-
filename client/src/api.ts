const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface DevelopmentRequester {
  id: number;
  name: string;
}

export interface ReferenceItem {
  id: number;
  name: string;
}

export interface CreateTicketInput {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  description: string;
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: DevelopmentRequester & { email: string };
  category: ReferenceItem;
  relatedSystem: ReferenceItem;
  summary: string;
  requestedPriority: CreateTicketInput["requestedPriority"];
  description: string;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  summary: string;
  category: ReferenceItem;
  relatedSystem: ReferenceItem;
  requestedPriority: CreateTicketInput["requestedPriority"];
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListQuery {
  search: string;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: CreateTicketInput["requestedPriority"] | null;
  currentStatus: string | null;
  sortBy: "createdAt" | "updatedAt" | "ticketNumber";
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: 10 | 20 | 50;
}

export interface TicketListResponse {
  items: TicketSummary[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
  applied: Omit<TicketListQuery, "page" | "pageSize">;
}

export interface ApiValidationError extends Error {
  fieldErrors?: Record<string, string[]>;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`);

  if (!healthResponse.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }

  const health = (await healthResponse.json()) as {
    status: string;
    service: string;
  };

  if (health.status !== "ok" || health.service !== "TokTickIT API") {
    throw new Error("TokTickIT API returned an invalid response");
  }

  const categoriesResponse = await fetch(`${API_URL}/api/categories`);

  if (!categoriesResponse.ok) {
    throw new Error("Unable to load IT request categories");
  }

  const categories = (await categoriesResponse.json()) as Category[];

  return {
    online: true,
    categories,
  };
}

export async function getDevelopmentRequesters(): Promise<DevelopmentRequester[]> {
  const response = await fetch(`${API_URL}/api/development-requesters`);
  if (!response.ok) throw new Error("Unable to load Development Requesters");
  const requesters = (await response.json()) as unknown;
  if (!Array.isArray(requesters) || !requesters.every((requester) => {
    if (!requester || typeof requester !== "object") return false;
    const candidate = requester as Partial<DevelopmentRequester>;
    return typeof candidate.id === "number" && Number.isSafeInteger(candidate.id) && candidate.id > 0 && typeof candidate.name === "string" && candidate.name.trim().length > 0;
  })) {
    throw new Error("TokTickIT API returned an invalid Requester response");
  }
  return requesters;
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null) as { error?: { message?: string; fieldErrors?: Record<string, string[]> } } | null;
  const error = new Error(body?.error?.message ?? fallback) as ApiValidationError;
  error.fieldErrors = body?.error?.fieldErrors;
  throw error;
}

export async function getCategories(): Promise<ReferenceItem[]> {
  const response = await fetch(`${API_URL}/api/categories`);
  if (!response.ok) return throwApiError(response, "Unable to load Categories");
  return parseReferenceItems(await response.json());
}

export async function getRelatedSystems(): Promise<ReferenceItem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`);
  if (!response.ok) return throwApiError(response, "Unable to load Related Systems");
  return parseReferenceItems(await response.json());
}

export async function getTickets(requesterId: number, query: TicketListQuery): Promise<TicketListResponse> {
  const params = new URLSearchParams();
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.categoryId !== null) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== null) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.requestedPriority !== null) params.set("requestedPriority", query.requestedPriority);
  if (query.currentStatus !== null) params.set("currentStatus", query.currentStatus);
  if (query.sortBy !== "updatedAt") params.set("sortBy", query.sortBy);
  if (query.sortDirection !== "desc") params.set("sortDirection", query.sortDirection);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 10) params.set("pageSize", String(query.pageSize));
  const response = await fetch(`${API_URL}/api/tickets${params.toString() ? `?${params}` : ""}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });
  if (!response.ok) return throwApiError(response, "Unable to load Tickets");
  const value = await response.json() as TicketListResponse;
  if (!value || !Array.isArray(value.items) || !value.pagination || typeof value.pagination.totalItems !== "number") {
    throw new Error("TokTickIT API returned invalid Ticket list data");
  }
  return value;
}

function parseReferenceItems(value: unknown): ReferenceItem[] {
  if (!Array.isArray(value) || !value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ReferenceItem>;
    return typeof candidate.id === "number" && Number.isSafeInteger(candidate.id) && candidate.id > 0 && typeof candidate.name === "string" && candidate.name.trim().length > 0;
  })) {
    throw new Error("TokTickIT API returned invalid reference data");
  }
  return value as ReferenceItem[];
}

export async function createTicket(requesterId: number, input: CreateTicketInput): Promise<{ ticket: CreatedTicket; replayed: boolean }> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requester-Id": String(requesterId) },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwApiError(response, "Unable to create Ticket");
  return await response.json() as { ticket: CreatedTicket; replayed: boolean };
}

export async function uploadTicketAttachment(requesterId: number, ticketId: number, file: File): Promise<unknown> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: { "X-Requester-Id": String(requesterId) },
    body: form,
  });
  if (!response.ok) return throwApiError(response, "Unable to upload Attachment");
  return response.json();
}
