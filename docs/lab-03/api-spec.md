# Lab 3 REST API Contract

Version 1.0, 2026-09-15. Prepared for review; these endpoints are planned, not yet implemented. Normative rules: [specification.md](specification.md), especially BR-01-40 and its authorization/transition matrices.

## 1. Conventions and access processing

Base `/api`; camelCase JSON; uppercase enums; positive safe integer resource IDs; UUID request keys; ISO 8601 UTC timestamps. JSON object bodies only unless multipart upload is stated. Unknown fields/parameters, repeated query parameters, invalid enum/ID/UUID and malformed JSON are `400 VALIDATION_FAILED`. No client-supplied author, timestamps, role claims, requester identity or password-change flags are trusted.

Protected processing order: session/account lookup -> initial-password restriction -> route role -> Origin/CSRF for writes -> input validation -> role/owner-scoped resource lookup -> transactional mutation/projection. Logout is the idempotent exception: check allowed Origin, look up any presented session, validate CSRF only for a valid session, delete it if present, clear cookie and return 204. Public login independently checks Origin/JSON and throttle before credential verification. Database/service errors fail closed.

Ignore X-Requester-Id for identity; unsupported requesterId JSON/query fields are rejected. Remove `/api/development-requesters`: `404 RESOURCE_NOT_FOUND`, with no user listing. Only health/login are public; OPTIONS is non-data CORS preflight. Staff means IT_STAFF or explicitly authorized ADMINISTRATOR throughout this file.

## 2. Session, cookie, CSRF and auth endpoints

- Cookie name `toktickit.sid`; value random 32-byte base64url token; only SHA-256 hash is persisted. Attributes: HttpOnly, SameSite=Lax, Path=/api, no Domain. Secure=true for HTTPS; Secure=false is allowed only for explicit local HTTP development/test. Clear with matching attributes. No token in JSON or browser storage.
- Normal session: absolute 8 hours, idle 30 minutes. Initial-password session: absolute/idle maximum 15 minutes. Cookie Max-Age matches absolute duration; server expiry/idle checks remain authoritative. No sliding absolute expiry.
- Configure CLIENT_ORIGIN as one exact scheme/host/port. CORS allows only it and credentials, allowed methods GET/POST/PATCH/DELETE/OPTIONS, headers Content-Type/X-CSRF-Token, and exposes Retry-After/Content-Disposition. No `*`; do not accept arbitrary reflected origins. Use matching hostnames (e.g. 127.0.0.1 on both client/API) in tests. No cross-site hosting change in this sprint.
- Each session has a separate random 32-byte hex csrfToken returned by login/me/password-change. Client keeps it only in memory and retrieves me after reload. Every authenticated POST/PATCH/DELETE, including upload and a valid-session logout, requires matching X-CSRF-Token and exact Origin. An absent/expired-session logout still enforces the allowed Origin but cannot validate a session CSRF token; it clears the cookie and returns `204`. Missing/untrusted Origin is rejected for browser writes; tests supply it. Login uses exact Origin and application/json to prevent login CSRF before a session exists.
- Password policy/hash/attempt limits are BR-08/09/14. Existing and new credential values are never echoed, logged or included in error fieldErrors. Credential errors have identical message `Unable to sign in with those credentials. Check your details or contact an administrator.`
- Login/password-change rotate the session token and CSRF token. Account edits/reset delete target sessions transactionally. Use `Cache-Control: no-store` on auth/user/Ticket/conversation responses and downloads. Password-bearing routes have bounded JSON size 16 KiB; other JSON routes 64 KiB.

| Method/path | Request | Success | Expected specific failures |
| --- | --- | --- | --- |
| GET /health | none | 200 `{status:"ok",service:"TokTickIT API"}` | safe 500 if unexpected |
| POST /auth/login | `{email:string,password:string}` | 200 AuthResponse plus Set-Cookie | 400 malformed input; 401 INVALID_CREDENTIALS; 403 CSRF_INVALID for Origin; 429 LOGIN_RATE_LIMITED |
| GET /auth/me | cookie | 200 AuthResponse for normal/restricted session | 401 SESSION_REQUIRED; safe 500 |
| POST /auth/change-password | `{currentPassword:string,newPassword:string,confirmPassword:string}` plus cookie/Origin/CSRF | 200 AuthResponse with mustChangePassword=false and fresh cookie; revoke all old user sessions | 400 VALIDATION_FAILED for new policy/confirmation/same password; 401 CURRENT_PASSWORD_INVALID or SESSION_REQUIRED; 403 CSRF_INVALID |
| POST /auth/logout | `{}` plus Origin; valid session also requires cookie/CSRF | 204, no body, delete current session if present and clear cookie, including absent/expired/repeated calls | 403 CSRF_INVALID for invalid Origin or invalid CSRF with a valid session; safe 500 |

Login validates email syntax and bounded password length (empty/oversize: 400); an otherwise well-formed wrong/short historical password yields the uniform 401. Invalid accounts use dummy hash verification. Bounded process-memory throttling uses fixed windows: five failed email/IP attempts, next request blocked; 30 failed IP attempts, next blocked. 429 contains integer Retry-After seconds until the relevant window expires. Process restart resets buckets; this local-lab limitation is explicit, and distributed/persistent throttling is deferred. A successful login resets only the pair counter and invalidates any presented current session before establishing a fresh one; other existing sessions remain until expiry/logout/password/account change.

## 3. Exact shared resource shapes

The following TypeScript-style definitions specify JSON fields. Optional fields are marked `?`; nullable values are explicit; otherwise fields are required. Internal model fields not listed must not appear. Author name/role reflect the current associated account, not an account-history record.

```ts
type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Status = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER"
  | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
type Ref = { id: number; name: string };
type SafeUser = { id: number; name: string; email: string; role: Role };
type AuthResponse = {
  user: SafeUser & { mustChangePassword: boolean };
  csrfToken: string; // 64 hex characters, not a session credential
};
type AdminUser = SafeUser & {
  isActive: boolean; mustChangePassword: boolean; version: number;
  passwordChangedAt: string | null; createdAt: string; updatedAt: string;
};
type EligibleOwner = SafeUser; // API restricts role to IT_STAFF/ADMINISTRATOR and active
type Attachment = {
  id: number; originalName: string; mimeType: string; sizeBytes: number;
  state: "ACTIVE" | "REMOVED"; uploadedAt: string;
  removedAt: string | null; removedReason: string | null;
  downloadUrl: string | null;
};
type TicketSummary = {
  id: number; ticketNumber: string; summary: string;
  category: Ref; relatedSystem: Ref; requestedPriority: Priority;
  itPriority: Priority; currentStatus: Status; version: number;
  ticketOwner: EligibleOwner | null; createdAt: string; updatedAt: string;
};
type StaffTicketSummary = TicketSummary & { requester: SafeUser };
type TicketDetail = TicketSummary & {
  ticketDate: string; requester: SafeUser; description: string;
  resolutionSummary: string | null; resolvedAt: string | null; closedAt: string | null;
  lastStatusReason: string | null;
  requesterResolvedAt: string | null; requesterResolvedBy: SafeUser | null;
  attachments: Attachment[];
};
// Operational detail uses the same shape. Former owner attribution is kept in
// the internal TicketOwnerChange table; no owner-history screen/list API is added.
// Conversations use their own endpoints.
// No TicketDetail contains Internal Notes or note counts.
type Entry = {
  id: number; ticketId: number; content: string;
  author: { id: number; name: string; role: Role }; createdAt: string;
};
type Pagination = {
  page: number; pageSize: 10 | 20 | 50; totalItems: number; totalPages: number;
  hasPreviousPage: boolean; hasNextPage: boolean;
};
type ListResponse<T, Q> = { items: T[]; pagination: Pagination; applied: Q };
type ErrorResponse = { error: {
  code: string; message: string; fieldErrors?: Record<string, string[]>;
  correlationId?: string;
}};
```

TicketSummary retains Lab 2 fields and adds itPriority/version/ticketOwner. TicketDetail.requester is the historical submitted User, even if that User's role has since changed. Removed Attachment downloadUrl=null; active URL retains the existing requester-compatible path and requires role/ownership checks. Attachment responses never return storageKey/filesystem paths. Password hashes, sessions, throttle keys and credential input are never included in user DTOs.

## 4. Preserved Requester and reference APIs

All require a normal active session; Ticket create/list/detail and upload/remove require REQUESTER. Shared Attachment reads/download allow Staff or the owning Requester. This intentionally replaces Lab 2 missing-header 400 with session 401 and role 403; it does not weaken owner checks.

| Method/path | Request | Success | Specific validation/conflict/not-found |
| --- | --- | --- | --- |
| GET /categories | none | 200 Ref[]; active only, id asc | safe 500 |
| GET /related-systems | none | 200 Ref[]; active only, id asc | safe 500 |
| POST /tickets | CreateTicketInput below | 201 `{ticket:TicketDetail,replayed:false}`; replay 200 `{ticket:TicketDetail,replayed:true}` | 400 validation/inactive references; 409 IDEMPOTENCY_CONFLICT |
| GET /tickets | RequesterListQuery below | 200 ListResponse<TicketSummary,RequesterApplied> | 400 invalid query |
| GET /tickets/:ticketId | none | 200 TicketDetail, own only | safe 404 for missing/non-owned |
| GET /tickets/:ticketId/attachments | none | 200 Attachment[], uploadedAt asc/id asc, active and removed | safe 404 parent missing/non-owned |
| POST /tickets/:ticketId/attachments | multipart one `file`, Origin/CSRF | 201 Attachment | 400 missing/multiple file, invalid type/signature/count; 413 ATTACHMENT_TOO_LARGE; safe 404 parent |
| GET /tickets/:ticketId/attachments/:attachmentId/download | none | 200 binary bytes, stored validated Content-Type, Content-Disposition attachment with safe filename, nosniff | safe 404 for missing/non-owned/removed/wrong parent |
| DELETE /tickets/:ticketId/attachments/:attachmentId | `{reason:string}` | 200 removed Attachment | 400 reason 5-250 invalid; safe 404 missing/non-owned/removed/wrong parent |
| POST /tickets/:ticketId/resolution-indication | `{expectedVersion:number}` | 200 TicketDetail; already-indicated current-version request returns unchanged detail | 409 VERSION_CONFLICT or RESOLUTION_INDICATION_UNAVAILABLE; safe 404 parent |

```ts
type CreateTicketInput = {
  clientRequestId: string; categoryId: number; relatedSystemId: number;
  summary: string; requestedPriority: Priority; description: string;
};
type RequesterApplied = {
  search: string; categoryId: number | null; relatedSystemId: number | null;
  requestedPriority: Priority | null; currentStatus: Status | null;
  sortBy: "createdAt" | "updatedAt" | "ticketNumber";
  sortDirection: "asc" | "desc";
};
```

Create semantics remain BR-20: normalize/hash editable payload excluding newly added server-owned workflow fields; use unique(authenticated requesterId,clientRequestId). On replay return the current saved detail without reinitializing status/IT Priority/owner or uploading files twice. Attachment uploads follow create individually; partial file failure never rolls back the saved Ticket. Summary/description and removal bounds match Lab 2.

RequesterListQuery accepts the RequesterApplied fields plus page/pageSize. Absent search="", nullable filters=null, sortBy=updatedAt, sortDirection=desc, page=1 and pageSize=10. Search trims to maximum 120 characters and uses case-insensitive ticketNumber/summary matching. All eight statuses now valid. Filters use AND. Sort uses id in the same direction as secondary tie-breaker. Pagination rules in section 5 apply. No requesterId filter.

## 5. Staff queue and operational APIs

Normal Staff sessions only. Operations apply to any Ticket, not only the current owner. Parent resource missing is safe 404. Requester calls to these paths return 403 before protected lookup.

| Method/path | Request | Success | Specific failures |
| --- | --- | --- | --- |
| GET /staff/tickets | QueueQuery below | 200 ListResponse<StaffTicketSummary,QueueApplied> | 400 query |
| GET /staff/tickets/:ticketId | none | 200 TicketDetail | safe 404 |
| GET /staff/ticket-owners | none | 200 EligibleOwner[]; active Staff/Admin, name asc/id asc | safe 500 |
| POST /staff/tickets/:ticketId/claim | `{expectedVersion:number}` | 200 TicketDetail; already self-owned is unchanged | 409 VERSION_CONFLICT, OWNER_CONFLICT, TICKET_TERMINAL |
| PATCH /staff/tickets/:ticketId/owner | `{ticketOwnerId:number|null,expectedVersion:number}` | 200 TicketDetail; identical owner is unchanged | 400 ASSIGNEE_INVALID for unknown/inactive/ineligible target; 409 VERSION_CONFLICT/TICKET_TERMINAL |
| PATCH /staff/tickets/:ticketId/it-priority | `{itPriority:Priority,expectedVersion:number}` | 200 TicketDetail; identical priority is unchanged | 400 invalid enum; 409 VERSION_CONFLICT/TICKET_TERMINAL |
| PATCH /staff/tickets/:ticketId/status | StatusInput below | 200 TicketDetail with authoritative workflow fields/version | 400 input; 409 VERSION_CONFLICT/STATUS_TRANSITION_INVALID |

```ts
type StatusInput = {
  currentStatus: Status; expectedVersion: number;
  resolutionSummary?: string; // only when target RESOLVED; 10-2000 trimmed
  reason?: string; // only when target REOPENED/CANCELLED; 5-250 trimmed
};
type QueueApplied = {
  search: string; categoryId: number | null; relatedSystemId: number | null;
  requestedPriority: Priority | null; itPriority: Priority | null;
  currentStatus: Status | null;
  owner: "all" | "unassigned" | "mine" | number;
  sortBy: "createdAt" | "updatedAt" | "ticketNumber" | "itPriority";
  sortDirection: "asc" | "desc";
};
```

- QueueQuery accepts exactly QueueApplied plus page/pageSize. Default owner=all, other defaults match Requester query; additional filters null. Numeric owner denotes a positive User ID (including a historically deactivated owner; no match returns empty). mine uses authenticated staff ID; unassigned uses NULL.
- Search covers ticketNumber/summary (max 120 trimmed characters). Search/all active filters combine AND. Category/system/user IDs must be positive safe integers, no arbitrary query objects. Values never concatenate into raw SQL.
- IT Priority sort ranks LOW=1/MEDIUM=2/HIGH=3/URGENT=4; itPriority desc then updatedAt desc then id desc, or all asc. Other sorts use chosen field/direction then id in the same direction. Default updatedAt desc/id desc. No summary/category sort.
- page is one-based positive safe integer; pageSize is exactly 10/20/50. Validate offset multiplication is a safe integer. totalPages=ceil(totalItems/pageSize), zero for no matches; hasPreviousPage=(page>1 && totalPages>0); hasNextPage=(page<totalPages). applied returns every normalized filter/sort including defaults, excluding page/pageSize. A valid beyond-end page has empty items and accurate metadata; no automatic server clamping.
- Owner, priority and indication no-op still validate expectedVersion and target eligibility/status first; no-op does not increment version. Status same-state always 409. Validate unsupported resolutionSummary/reason on other transition targets as 400, not ignored. Staff owner/priority mutations on CLOSED/CANCELLED remain 409; Admin account deactivation/demotion performs an internal eligibility cleanup on all currently assigned Tickets, including terminal Tickets, as specified in BR-23. That cleanup appends TicketOwnerChange before clearing ticketOwnerId, increments Ticket.version and preserves status/resolution fields.
- Mutation transactions check current role/activation, Ticket version, status and assignee eligibility, then update atomically. Changed owner writes append TicketOwnerChange with previous/next owner, actor and timestamp in the same transaction; no-op writes do not. Admin demotion/deactivation serializes with assignment eligibility checks to prevent newly assigning an ineligible owner. Priority/owner/status/indication writes increment version and updatedAt when changed.

## 6. Public Comments and Internal Notes

| Method/path | Access | Request | Success |
| --- | --- | --- | --- |
| GET /tickets/:ticketId/comments | Own Requester or Staff | none | 200 `{items:Entry[]}` |
| POST /tickets/:ticketId/comments | Own Requester or Staff | `{content:string}` | 201 `{entry:Entry}` |
| GET /tickets/:ticketId/internal-notes | Staff only | none | 200 `{items:Entry[]}` |
| POST /tickets/:ticketId/internal-notes | Staff only | `{content:string}` | 201 `{entry:Entry}` |

No PUT/PATCH/DELETE entries; unsupported methods receive safe 405 METHOD_NOT_ALLOWED with an Allow header. Lists contain all entries in createdAt asc/id asc; conversation pagination is not required by this sprint. content trims to 1-5000 JS string units. Reject authorId/createdAt/visibility/clientRequestId fields with 400. Each valid POST appends one entry; backend replay/deduplication is deferred beyond Lab 3. A failed/ambiguous network response may have saved an entry, so the UI reloads the list and asks the user to review before a manual retry. Parents missing/non-owned return 404; Requester Internal Note access is 403 before lookup; no private payload in errors. GET arrays can be empty. Shared access applies even on terminal Tickets, without modifying workflow fields. Authors/times come from backend; no note content/count is embedded in Requester queue/detail.

## 7. Administrator User Management

Normal ADMINISTRATOR only. Account list is the sole user-management screen; eligible staff list above is a distinct minimal operational DTO, not admin access.

| Method/path | Request | Success | Specific failures |
| --- | --- | --- | --- |
| GET /admin/users | search? max120 trimmed, role? Role; no other parameters | 200 `{items:AdminUser[],applied:{search:string,role:Role|null}}`, name asc/id asc | 400 query; 403 wrong role |
| POST /admin/users | `{name:string,email:string,role:Role,isActive:boolean,initialPassword:string}` | 201 `{user:AdminUser}`; mustChangePassword=true | 400 validation; 409 EMAIL_CONFLICT |
| PATCH /admin/users/:userId | full `{name:string,email:string,role:Role,isActive:boolean,expectedVersion:number}`; omitted fields invalid | 200 `{user:AdminUser,reauthenticationRequired:boolean}` | 400 validation; 404 missing; 409 EMAIL_CONFLICT/VERSION_CONFLICT/ADMIN_SELF_DEACTIVATION/LAST_ACTIVE_ADMIN |
| POST /admin/users/:userId/initial-password | `{initialPassword:string,expectedVersion:number}` | 200 `{user:AdminUser,reauthenticationRequired:boolean}` | 400 policy; 404 missing; 409 VERSION_CONFLICT |

Admin search case-insensitively matches name/email using OR; optional role combines using AND. Include active/inactive users; no pagination, status filter, sorting query or multiple roles. Trim name 1-120, normalize email max254 and enforce uniqueness for all users. Boolean activation is required, not a string. Initial password follows BR-08; reset must differ from the current hash-verified password. No password is returned; supply it manually and clear the form on success/exit.

Account edits increment User.version/updatedAt and delete target sessions in the same transaction. Self edits/reset return reauthenticationRequired=true and clear the current cookie so the UI clears local auth state after the response; other-user changes return false. Initial-password reset sets mustChangePassword=true, passwordChangedAt=null and stores a new hash; self reset requires login then mandatory change. A successful self-service password change instead records passwordChangedAt=backend now, increments User.version/updatedAt, clears mustChangePassword and establishes a fresh session after revoking old sessions. Creating an inactive user still provisions its hash but cannot login until activated. Demotion/deactivation unassigns every Ticket currently owned by the target, including CLOSED/CANCELLED, when the target loses active Staff/Admin eligibility. Each affected Ticket gets a TicketOwnerChange provenance row and version/updatedAt increment while status/resolution/requester/author/remover fields stay unchanged. This internal account-safety cleanup is not the staff owner API and preserves the active-owner invariant. Shared transaction advisory locks and rechecks protect last-admin invariants and eligibility against concurrent account/assignment mutations. Creation also participates in account-safety serialization.

## 8. Error/status contract

| HTTP | Codes/meaning |
| --- | --- |
| 400 | VALIDATION_FAILED; ASSIGNEE_INVALID; ATTACHMENT_INVALID; ATTACHMENT_LIMIT_REACHED. Invalid input, never credential values in fieldErrors. |
| 401 | INVALID_CREDENTIALS (login); SESSION_REQUIRED (missing/expired/revoked/inactive protected routes other than logout); CURRENT_PASSWORD_INVALID (authenticated password check). Invalid session cookie is cleared. Logout itself uses idempotent 204 for absent/expired sessions. |
| 403 | PASSWORD_CHANGE_REQUIRED; ROLE_FORBIDDEN; CSRF_INVALID. No protected data or existence hints. |
| 404 | RESOURCE_NOT_FOUND. Same generic message for missing/non-owned parent/attachment; removed files remain unavailable. |
| 405 | METHOD_NOT_ALLOWED on forbidden conversation edits/deletes and user deletion, with correct Allow header. |
| 409 | EMAIL_CONFLICT; IDEMPOTENCY_CONFLICT; VERSION_CONFLICT; OWNER_CONFLICT; TICKET_TERMINAL; STATUS_TRANSITION_INVALID; RESOLUTION_INDICATION_UNAVAILABLE; ADMIN_SELF_DEACTIVATION; LAST_ACTIVE_ADMIN. No partial writes; refresh/review before retry. |
| 413 | ATTACHMENT_TOO_LARGE or PAYLOAD_TOO_LARGE. No stored partial file/metadata. |
| 429 | LOGIN_RATE_LIMITED; generic feedback and integer Retry-After. |
| 500 | INTERNAL_ERROR with correlationId, safe message `Unable to complete this request. Please try again.`; internal details server-side. Preserve existing safe Lab 2 file-compensation behavior. |

Expected errors use `{error:{code,message,fieldErrors?}}`; unexpected 500 requires correlationId. Envelope aligns with existing client ApiValidationError processing. All routes may fail with 500; protected routes may fail with 401/403 and writes with CSRF 403 in addition to their listed specific failures. Tests assert no password, raw token, SQL, filesystem path or private Note fragments in errors. Password/page-request redaction applies to logger, Playwright traces and evidence, not only DTOs.

## 9. Contract verification

Validate exact response/status types, defaults, bounds, enum order, missing/non-owner projections, concurrency/no-op semantics, CSRF for multipart, idempotent logout and session revocation in [tests.md](tests.md). Changing an endpoint/shape/policy requires synchronized specification/UI/tests updates before dependent implementation; do not leave alternative response/status choices unresolved.
