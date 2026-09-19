const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

export interface AuthUser { id: number; name: string; email: string; role: Role; mustChangePassword: boolean }
export interface AuthResponse { user: AuthUser; csrfToken: string }
export interface ReferenceItem { id: number; name: string }
export interface SafeUser { id: number; name: string; email: string; role?: Role }

export interface CreateTicketInput {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: Priority;
  description: string;
}

export interface TicketAttachmentMetadata {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  state: "ACTIVE" | "REMOVED";
  uploadedAt: string;
  removedAt: string | null;
  removedReason: string | null;
  downloadUrl: string | null;
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  summary: string;
  category: ReferenceItem;
  relatedSystem: ReferenceItem;
  requestedPriority: Priority;
  itPriority?: Priority;
  currentStatus: TicketStatus;
  version?: number;
  ticketOwner?: SafeUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends TicketSummary {
  ticketDate: string;
  requester: SafeUser;
  description: string;
  resolutionSummary?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  lastStatusReason?: string | null;
  requesterResolvedAt?: string | null;
  requesterResolvedBy?: SafeUser | null;
  attachments: TicketAttachmentMetadata[];
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: SafeUser;
  category: ReferenceItem;
  relatedSystem: ReferenceItem;
  summary: string;
  requestedPriority: Priority;
  description: string;
  currentStatus: TicketStatus | string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListQuery {
  search: string;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: Priority | null;
  currentStatus: TicketStatus | null;
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

export interface EligibleOwner extends SafeUser { role: "IT_STAFF" | "ADMINISTRATOR" }
export interface StaffTicketSummary extends TicketSummary {
  itPriority: Priority;
  version: number;
  ticketOwner: EligibleOwner | null;
  requester: SafeUser & { role: Role };
}
export type StaffQueueOwner = "all" | "unassigned" | "mine" | number;
export interface StaffQueueQuery {
  search: string;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: Priority | null;
  itPriority: Priority | null;
  currentStatus: TicketStatus | null;
  owner: StaffQueueOwner;
  sortBy: "createdAt" | "updatedAt" | "ticketNumber" | "itPriority";
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: 10 | 20 | 50;
}
export interface StaffTicketListResponse {
  items: StaffTicketSummary[];
  pagination: { page: number; pageSize: 10 | 20 | 50; totalItems: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
  applied: Omit<StaffQueueQuery, "page" | "pageSize">;
}

export interface ApiValidationError extends Error {
  statusCode?: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  retryAfter?: number;
}

export interface SystemStatus { online: boolean; categories: ReferenceItem[] }

let csrfToken: string | null = null;

export function clearInMemoryAuth(): void { csrfToken = null; }

function applyAuth(response: AuthResponse): AuthResponse {
  if (!response?.user || typeof response.csrfToken !== "string") throw new Error("TokTickIT API returned an invalid authentication response");
  csrfToken = response.csrfToken;
  return response;
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> } } | null;
  const error = new Error(body?.error?.message ?? fallback) as ApiValidationError;
  error.statusCode = response.status;
  error.code = body?.error?.code;
  error.fieldErrors = body?.error?.fieldErrors;
  const retryAfter = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfter = retryAfter;
  throw error;
}

async function apiFetch(path: string, init: RequestInit = {}, options: { authenticated?: boolean; csrf?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (options.csrf) {
    if (!csrfToken) throw Object.assign(new Error("Authentication session needs to be restored."), { statusCode: 401, code: "SESSION_REQUIRED" });
    headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(`${API_URL}/api${path}`, { ...init, credentials: "include", headers });
  if (options.authenticated && (response.status === 401 || response.status === 403)) {
    const body = await response.clone().json().catch(() => null) as { error?: { code?: string } } | null;
    if (body?.error?.code === "SESSION_REQUIRED" || body?.error?.code === "PASSWORD_CHANGE_REQUIRED") {
      window.dispatchEvent(new CustomEvent("toktickit:session-invalid", { detail: { code: body?.error?.code } }));
    }
  }
  return response;
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await apiFetch("/health");
  if (!healthResponse.ok) throw new Error("Unable to connect to TokTickIT API");
  const health = await healthResponse.json() as { status: string; service: string };
  if (health.status !== "ok" || health.service !== "TokTickIT API") throw new Error("TokTickIT API returned an invalid response");
  return { online: true, categories: await getCategories() };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiFetch("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!response.ok) return throwApiError(response, "Unable to sign in. Please try again.");
  return applyAuth(await response.json() as AuthResponse);
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await apiFetch("/auth/me");
  if (!response.ok) return throwApiError(response, "Unable to restore your session.");
  return applyAuth(await response.json() as AuthResponse);
}

export async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<AuthResponse> {
  const response = await apiFetch("/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) }, { authenticated: true, csrf: true });
  if (!response.ok) return throwApiError(response, "Unable to change the password. Please try again.");
  return applyAuth(await response.json() as AuthResponse);
}

export async function logout(): Promise<void> {
  const response = await apiFetch("/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, { csrf: csrfToken !== null });
  if (!response.ok) return throwApiError(response, "Unable to log out. Please try again.");
  clearInMemoryAuth();
}

function parseReferenceItems(value: unknown): ReferenceItem[] {
  if (!Array.isArray(value) || !value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<ReferenceItem>;
    return typeof candidate.id === "number" && Number.isSafeInteger(candidate.id) && candidate.id > 0 && typeof candidate.name === "string" && candidate.name.trim().length > 0;
  })) throw new Error("TokTickIT API returned invalid reference data");
  return value as ReferenceItem[];
}

export async function getCategories(): Promise<ReferenceItem[]> {
  const response = await apiFetch("/categories", {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to load Categories");
  return parseReferenceItems(await response.json());
}

export async function getRelatedSystems(): Promise<ReferenceItem[]> {
  const response = await apiFetch("/related-systems", {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to load Related Systems");
  return parseReferenceItems(await response.json());
}

export async function getTickets(query: TicketListQuery): Promise<TicketListResponse> {
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
  const response = await apiFetch(`/tickets${params.size ? `?${params}` : ""}`, {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to load Tickets");
  const value = await response.json() as TicketListResponse;
  if (!value || !Array.isArray(value.items) || !value.pagination || typeof value.pagination.totalItems !== "number") throw new Error("TokTickIT API returned invalid Ticket list data");
  return value;
}

export async function getStaffTickets(query: StaffQueueQuery): Promise<StaffTicketListResponse> {
  const params = new URLSearchParams();
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.categoryId !== null) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== null) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.requestedPriority !== null) params.set("requestedPriority", query.requestedPriority);
  if (query.itPriority !== null) params.set("itPriority", query.itPriority);
  if (query.currentStatus !== null) params.set("currentStatus", query.currentStatus);
  if (query.owner !== "all") params.set("owner", String(query.owner));
  if (query.sortBy !== "updatedAt") params.set("sortBy", query.sortBy);
  if (query.sortDirection !== "desc") params.set("sortDirection", query.sortDirection);
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 10) params.set("pageSize", String(query.pageSize));
  const response = await apiFetch(`/staff/tickets${params.size ? `?${params}` : ""}`, {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to load the Ticket Queue.");
  const value = await response.json() as StaffTicketListResponse;
  if (!value || !Array.isArray(value.items) || !value.pagination || typeof value.pagination.totalItems !== "number" || !value.applied) {
    throw new Error("TokTickIT API returned invalid Staff Ticket Queue data");
  }
  return value;
}

export async function getEligibleTicketOwners(): Promise<EligibleOwner[]> {
  const response = await apiFetch("/staff/ticket-owners", {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to load eligible Ticket owners.");
  const value = await response.json() as EligibleOwner[];
  if (!Array.isArray(value) || value.some((owner) => typeof owner?.id !== "number" || typeof owner.name !== "string" || typeof owner.email !== "string" || (owner.role !== "IT_STAFF" && owner.role !== "ADMINISTRATOR"))) {
    throw new Error("TokTickIT API returned invalid eligible-owner data");
  }
  return value;
}

export async function getTicketDetail(ticketId: number): Promise<TicketDetail> {
  const response = await apiFetch(`/tickets/${ticketId}`, {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to load Ticket Detail");
  const value = await response.json() as TicketDetail;
  if (!value || typeof value.id !== "number" || typeof value.ticketNumber !== "string" || !value.requester || !value.category || !value.relatedSystem || typeof value.summary !== "string" || typeof value.description !== "string" || !Array.isArray(value.attachments)) throw new Error("TokTickIT API returned invalid Ticket Detail data");
  return value;
}

export async function createTicket(input: CreateTicketInput): Promise<{ ticket: CreatedTicket; replayed: boolean }> {
  const response = await apiFetch("/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, { authenticated: true, csrf: true });
  if (!response.ok) return throwApiError(response, "Unable to create Ticket");
  return await response.json() as { ticket: CreatedTicket; replayed: boolean };
}

export async function uploadTicketAttachment(ticketId: number, file: File): Promise<unknown> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiFetch(`/tickets/${ticketId}/attachments`, { method: "POST", body: form }, { authenticated: true, csrf: true });
  if (!response.ok) return throwApiError(response, "Unable to upload Attachment");
  const value = await response.json() as TicketAttachmentMetadata;
  if (!value || typeof value.id !== "number" || typeof value.originalName !== "string" || typeof value.mimeType !== "string" || typeof value.sizeBytes !== "number" || (value.state !== "ACTIVE" && value.state !== "REMOVED")) throw new Error("TokTickIT API returned invalid Attachment data");
  return value;
}

export async function downloadTicketAttachment(ticketId: number, attachmentId: number): Promise<Blob> {
  const response = await apiFetch(`/tickets/${ticketId}/attachments/${attachmentId}/download`, {}, { authenticated: true });
  if (!response.ok) return throwApiError(response, "Unable to download Attachment");
  return response.blob();
}

export async function removeTicketAttachment(ticketId: number, attachmentId: number, reason: string): Promise<TicketAttachmentMetadata> {
  const response = await apiFetch(`/tickets/${ticketId}/attachments/${attachmentId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }, { authenticated: true, csrf: true });
  if (!response.ok) return throwApiError(response, "Unable to remove Attachment");
  const value = await response.json() as TicketAttachmentMetadata;
  if (!value || typeof value.id !== "number" || value.state !== "REMOVED" || value.downloadUrl !== null) throw new Error("TokTickIT API returned invalid removed Attachment data");
  return value;
}

export async function indicateResolution(ticketId: number, expectedVersion: number): Promise<TicketDetail> {
  const response = await apiFetch(`/tickets/${ticketId}/resolution-indication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion }) }, { authenticated: true, csrf: true });
  if (!response.ok) return throwApiError(response, "Unable to save the resolution indication.");
  return await response.json() as TicketDetail;
}
