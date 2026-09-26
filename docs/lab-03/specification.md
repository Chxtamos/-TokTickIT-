# Lab 3 Sprint Engineering Specification

Contract version: 1.0, prepared 2026-09-15. Status: prepared for student/peer review; implementation and product completion are not claimed.

Source: supplied `Lab_3_sheet.pdf`, all 18 pages, especially sections 4-10 and 14. Lab 2 baseline: local `main` commit `439ee7e`. See [README.md](README.md) for the inspected baseline and [implementation-plan.md](implementation-plan.md) for the proposed Issues.

The handout is the assignment source. Requirements explicitly fixed by it remain mandatory. Concrete choices below resolve its intentionally unspecified details; they are project decisions, not quotations from the instructor. Sample images do not override written exclusions (including email reset, Service Actions and advanced user management).

## 1. Sprint Goal

Extend the existing Requester MVP with email/password authentication, mandatory initial-password change, backend role/ownership enforcement, an operational IT Staff Ticket Queue and Ticket Detail, shared Public Comments, restricted Internal Notes, and minimalist Administrator User Management. Preserve existing Tickets, Attachments, numbering, reference data, and permitted Requester behavior while replacing the Development Requester selector.

## 2. Stakeholder Request

Real accounts must replace the temporary requester context. Requesters continue handling their own submissions and communicate with support. IT Staff find, own, prioritize and progress work. Administrators manage accounts. Every screen and API observes the authorization matrix; hidden controls alone never grant protection. All screens extend the existing Zen Green application.

## 3. Scope

Included: the sprint goal; forward-only Prisma/PostgreSQL migrations and idempotent local seed; all four normative contract documents; traceable tests; Issues, feature PRs, peer review, staged integration, visual evidence and the final nine-part PDF.

Excluded: self-registration; invitations or password-reset email; MFA, social login and SSO; Actions Taken/Service Actions; SLA/escalation/notifications; analytics beyond simple queue totals; organizations/departments/multi-tenancy; multiple roles per user; user deletion, bulk operations, import/export, role/account-history screens, profile pictures, account unlocking or advanced identity management; mandatory admin pagination or multi-column sorting; production deployment/cloud changes. Requester editing/deleting saved Ticket fields is not added: Lab 2 implemented read-only detail and Attachment management.

## 4. Functional Requirements

- **FR-01:** Authenticate an active, provisioned User using email/password with safe failure feedback and bounded attempts.
- **FR-02:** A successful initial-password login permits only current-user retrieval, mandatory password change and logout before normal application access; its restricted session expires exactly 15 minutes after issuance regardless of activity.
- **FR-03:** Change password after current-password verification and valid new-password confirmation; atomically record passwordChangedAt, increment User.version/updatedAt, revoke old sessions and persist a fresh normal session before its cookie is sent.
- **FR-04:** Restore the session through current-user retrieval; display name/role; logout invalidates server access and clears account-specific UI state.
- **FR-05:** Enforce the matrix in section 5 on the backend and reflect it in navigation, controls and direct screen guards.
- **FR-06:** Replace RequesterUser with User while preserving IDs, activation, Ticket ownership and Attachment removal attribution; remove the selector, Change Requester and requester storage key.
- **FR-07:** Continue Lab 2 create/list/detail, reference data, numbering, idempotency and validation using the authenticated Requester's ID.
- **FR-08:** Preserve owner-only upload/download/soft removal, removed metadata, private file storage and Lab 2 file limits.
- **FR-09:** Requesters read/write Public Comments only on their own Tickets and indicate that a problem appears resolved without changing status.
- **FR-10:** IT Staff retrieve a shared queue with search, filters, deterministic sorting and pagination defined in api-spec.md.
- **FR-11:** IT Staff open Ticket Detail with submitted information, requester, ownership, both priorities, status, Attachments and role-permitted conversations.
- **FR-12:** Claim, assign or reassign one primary Ticket Owner using validated active eligible accounts and concurrency checks; retain owner-change provenance when ownership changes or an account loses eligibility. Staff manual unassign is excluded from Lab 3.
- **FR-13:** Initialize IT Priority from Requested Priority and permit operational updates without changing the submitted Requested Priority.
- **FR-14:** Enforce all eight statuses and the transition matrix, resolution requirements, confirmation and stale-write behavior.
- **FR-15:** Retrieve/create Public Comments with backend author/time, plain-text rendering and append-only semantics.
- **FR-16:** Retrieve/create Internal Notes for operational roles only; prevent note content/metadata/counts from Requester responses.
- **FR-17:** Administrators list users, search name/email, optionally filter one role, and create accounts with one role and initial password.
- **FR-18:** Administrators edit name/email/role/activation, prevent duplicates and protect self/last-active-Administrator safety.
- **FR-19:** Administrators set a new initial password; invalidate the target's sessions and require password change at next login.
- **FR-20:** Deactivation or role/account changes invalidate affected sessions; losing owner eligibility safely unassigns affected Tickets.
- **FR-21:** Extend the existing Zen Green tokens, reusable controls, badges and shell across desktop/tablet/mobile with keyboard and accessible feedback.
- **FR-22:** Provide relevant loading, saving, validation, success, empty/no-results, forbidden, not-found, conflict and safe failure feedback.
- **FR-23:** Provision migrated accounts safely, seed required roles/workflow examples repeatedly without resetting existing credentials or work.
- **FR-24:** Create the test plan before implementation; demonstrate unit, API/PostgreSQL, UI/style, authorization, migration/regression, responsive/accessibility and E2E coverage.
- **FR-25:** Complete Issues, reviewed feature PRs into lab3-staging, release into main, truthful AI/reviewer records and final submission evidence.

## 5. Business Rules and Authorization

### Authentication and account rules

- **BR-01:** Only active Users with a non-null password hash and valid credentials authenticate. Unknown email, wrong password, inactive and unprovisioned accounts use identical `401 INVALID_CREDENTIALS` feedback.
- **BR-02:** `mustChangePassword=true` blocks normal protected endpoints with `403 PASSWORD_CHANGE_REQUIRED`, including reference data. A restricted initial-password session sets `expiresAt = createdAt + 15 minutes`, is valid only while backend time is strictly earlier than expiresAt, and expires when `now >= expiresAt`. It has no idle timeout: requests never extend expiresAt and never update lastSeenAt. After expiry, me/change-password return `401 SESSION_REQUIRED`; idempotent logout remains `204`.
- **BR-03:** Requester ownership comes only from the authenticated User. Ignore `X-Requester-Id` as identity; reject unsupported requesterId JSON/query fields with `400`; neither mechanism can impersonate another account.
- **BR-04:** Public Comments are readable by the owning Requester and operational roles. Internal Notes are readable only by IT Staff/Administrator, never returned to a Requester through any projection.
- **BR-05:** Requester resolution indication does not set Resolved or Closed. Only operational roles perform formal transitions.
- **BR-06:** One User has exactly one role: `REQUESTER`, `IT_STAFF` or `ADMINISTRATOR`. No role array or self-registration.
- **BR-07:** Normalize email with trim/lowercase; validate syntax and maximum 254 characters; enforce uniqueness in PostgreSQL, including inactive accounts. Trim names to 1-120 characters.
- **BR-08:** Passwords contain 15-128 Unicode code points, allow spaces/Unicode, reject whitespace-only and over 512 UTF-8 bytes, and are never trimmed or silently truncated. New/initial passwords use the same policy; confirmation must match exactly; a replacement must differ from the current password. No mandatory composition rule is inferred from sample images.
- **BR-09:** The proposed Node.js password-hashing profile is asynchronous scrypt with N=131072, r=8, p=1, 64-byte output, random 16-byte salt and maxmem=256 MiB. Before implementation freezes this profile, run PERF-01 on the intended local and CI runtimes. Record latency and peak memory for serial and two concurrent hashes; the gate is p95 <= 2 seconds and additional peak RSS <= 320 MiB for two concurrent hashes. If it fails, revise and review the profile and its tests before coding; never silently lower the cost in code. Store a versioned encoding of parameters/salt/hash; use constant-time comparison and a dummy hash for unavailable users. SHA-256 is only for random session-token hashes and existing Ticket payload idempotency, not passwords.
- **BR-10:** PostgreSQL holds opaque sessions; issue a random 32-byte token through an HttpOnly cookie. Do not put session credentials/passwords in browser storage, URLs, client bundles, repository files, screenshots, traces or logs.
- **BR-11:** Normal sessions expire after 8 hours absolute or 30 minutes idle, whichever occurs first; their lastSeenAt may advance after a valid request without changing absolute expiresAt. Restricted sessions use only BR-02's fixed 15-minute expiry. Login rotates tokens; logout deletes the current session if present and always clears the cookie. Repeated logout, including absent/expired sessions, succeeds with empty `204` so it is idempotent. A valid active session still requires its CSRF token; an absent/expired session has no token to validate. Password change/reset deletes all target sessions. No remember-me feature.
- **BR-12:** Session middleware reloads current User activation/role/password-change state on every protected request; database failures fail closed. It may update lastSeenAt only for normal sessions and never for restricted sessions. For password change, derive the candidate hash and random replacement token/CSRF values before the database transaction. The transaction locks/rechecks the active User and authenticated session snapshot, updates the credential/password flags/version, deletes every old session and inserts exactly one normal replacement session. Any database-step failure rolls back all three state changes, so the old credential/sessions remain authoritative. Only after commit may the server emit Set-Cookie and AuthResponse. If response delivery fails after commit, the new password is authoritative, all old sessions remain revoked and the user recovers through normal login with the new password. Account edits/reset revoke target sessions within their own account transaction and do not create a replacement session unless the endpoint explicitly says so.
- **BR-13:** Require a configured exact browser Origin, credentialed non-wildcard CORS, JSON-only login and a per-session X-CSRF-Token for authenticated POST/PATCH/DELETE, including multipart upload. Missing/untrusted Origin or invalid CSRF is `403 CSRF_INVALID`; SameSite alone is insufficient.
- **BR-14:** Allow at most five failed logins per normalized-email/IP pair per fixed 15-minute window and 30 per IP/window. The next attempt returns generic `429 LOGIN_RATE_LIMITED` with Retry-After seconds. Successful login resets the pair bucket; no persistent account lock/unlock UI. For this local-lab sprint, use a bounded in-memory throttle keyed by hashes of normalized email/IP; restart resets the buckets. Production-wide distributed throttling is outside Lab 3.
- **BR-15:** Admin create/reset accepts an entered initial password and never returns it. Deliver it manually through the local-lab arrangement; no email. Initial-password provisioning is specified in section 7, not deferred to implementation.
- **BR-16:** No Administrator can deactivate their own account. No edit can demote/deactivate the last active Administrator. Serialize account-safety writes using a shared PostgreSQL transaction advisory lock and recheck counts in that transaction, including concurrent attempts.
- **BR-17:** Deactivate instead of deleting users. Name/email/role/activation edits revoke all target sessions; editing one's own account therefore requires signing in again. All admin updates use expectedVersion; stale edits return `409`.

### Authorization matrix (explicit project decision)

Administrator primarily manages accounts, but this contract explicitly also permits operational Ticket access/actions for Administrators. This resolves the handout's Administrator-eligible Ticket Owner/IT Priority rules and required Comment/Note visibility while keeping a single assigned role. Administrator is not automatically a Requester. This extension is permitted by section 4.3 and must be reviewed with the contract.

| Operation | Anonymous | Initial-password session | Requester | IT Staff | Administrator |
| --- | --- | --- | --- | --- | --- |
| Health; login | Yes | Yes | Yes | Yes | Yes |
| Current user; password change | No | Yes | Yes | Yes | Yes |
| Logout/clear cookie | Yes, empty 204 | Yes | Yes | Yes | Yes |
| Active categories/related systems | No | No | Yes | Yes | Yes |
| Create Ticket; My Tickets | No | No | Yes, self | No | No |
| Requester Ticket detail | No | No | Own only | No | No |
| Shared queue; operational detail; eligible owners | No | No | No | Yes | Yes |
| Claim/assign; IT Priority; status transitions | No | No | No | Yes | Yes |
| Read attachment metadata/download | No | No | Own only | Any Ticket | Any Ticket |
| Upload/soft-remove attachments | No | No | Own only | No | No |
| Read/create Public Comments | No | No | Own only | Any Ticket | Any Ticket |
| Read/create Internal Notes | No | No | No | Any Ticket | Any Ticket |
| Problem Appears Resolved | No | No | Own eligible Ticket | No | No |
| List/create/edit users; initial-password reset | No | No | No | No | Yes |

- **BR-18:** Every protected resource route checks session, account state and permitted role before parsing/querying resources; authenticated Requester resource queries then scope by requesterId. Login/health are public and logout has the BR-11 idempotent absent-session exception. Operational writes are shared-role actions, not restricted to the currently assigned staff member.
- **BR-19:** Anonymous access is `401`; wrong-role endpoints are `403`; missing and non-owned Requester Ticket/Attachment/Comment parents use the same `404 RESOURCE_NOT_FOUND`, with no data/bytes or resource-existence hints. Note endpoints return `403` for Requesters before lookup.

### Ticket, ownership and workflow rules

- **BR-20:** Preserve Lab 2 TKT-YYYY-NNNNNN backend UTC-year/sequence numbering, valid references, summary 5-120 and description 10-5000 trimmed JS string units, requested priorities LOW/MEDIUM/HIGH/URGENT, and create-request UUID/payload-hash idempotency. Do not reset the sequence or regenerate historical numbers.
- **BR-21:** A new Ticket is NEW, unassigned, with IT Priority equal to Requested Priority and version=1. Requested Priority and submitted fields remain immutable after creation.
- **BR-22:** There is at most one primary Ticket Owner. Assignment targets must currently be active IT Staff or Administrator. Claim assigns self only when unassigned; claiming a Ticket already owned by self is a no-op; another owner's claim is `409 OWNER_CONFLICT`. Claim does not change status automatically. Assigning an unowned Ticket or reassigning an owned Ticket appends TicketOwnerChange in the same transaction; a no-op does not append an event. Staff manual unassign and a nullable owner request are not supported in Lab 3.
- **BR-23:** User-driven deactivation/demotion revokes sessions and automatically clears every Ticket whose current owner loses eligibility, including CLOSED/CANCELLED. This account-safety cleanup is the only Lab 3 path from a non-null owner to null and is not a staff owner-mutation endpoint; staff claim/assign/reassign and IT Priority remain rejected on CLOSED/CANCELLED. The cleanup records a TicketOwnerChange row with previous owner, null next owner, actor and timestamp before clearing ticketOwnerId. Former owner attribution survives in this append-only record; requester/author/remover FKs also remain intact. Closed/Cancelled status and public resolution fields do not change. Reopening may then assign a new eligible owner through normal rules.
- **BR-24:** All operational writes and Requester indication carry expectedVersion, a positive integer equal to Ticket.version. Check and update atomically; increment version for owner, IT Priority, status and indication changes. Concurrent losers return `409 VERSION_CONFLICT` without partial writes.
- **BR-25:** Status values are NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED and CANCELLED. Only transitions in the matrix below are permitted; all others, including same-state changes, return `409 STATUS_TRANSITION_INVALID`.
- **BR-26:** Entering RESOLVED requires a trimmed public resolutionSummary of 10-2000 JS string units; record resolvedAt on the backend. Entering CLOSED requires an existing resolution summary and records closedAt.
- **BR-27:** REOPENED and CANCELLED require a trimmed public reason of 5-250 JS string units. Store lastStatusReason; reopen clears resolutionSummary/resolvedAt/closedAt and the Requester indication for the new work cycle. A non-reason transition clears lastStatusReason.
- **BR-28:** The UI confirms every status change, reassignment, resolution indication, password reset and activation change. Backend validates independently; confirmations are deliberate UI steps, not client-supplied authorization flags.
- **BR-29:** Requester indication is available in OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER or REOPENED. Store backend requesterResolvedAt/requesterResolvedById; repeated indication with the current version is a no-op; no withdrawal flow. Indication is not a prerequisite for staff resolution.
- **BR-30:** Comment/Note create is permitted in every status, including CLOSED/CANCELLED, to retain communication continuity; attachment owner actions retain Lab 2 status-independent behavior. Neither changes status or ownership.

| From | Permitted next statuses | Additional required input |
| --- | --- | --- |
| NEW | OPEN, CANCELLED | reason for CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED | reason for CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | resolutionSummary for RESOLVED; reason for CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED | resolutionSummary for RESOLVED; reason for CANCELLED |
| RESOLVED | CLOSED, REOPENED | stored summary for CLOSED; reason for REOPENED |
| CLOSED | REOPENED | reason |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED | reason for CANCELLED |
| CANCELLED | None | terminal |

The same matrix applies to IT Staff and Administrator. Requesters have no status-transition endpoint permission. Actions Taken completion is not required to resolve in Lab 3; that later rule belongs to Lab 4.

### Conversations, attachments, query and failure rules

- **BR-31:** Comments/Notes are append-only. Trim content and require 1-5000 JS string units, preserving internal whitespace/newlines. Author ID and creation time are backend-owned. Render as plain text through React escaping; no HTML/Markdown execution.
- **BR-32:** Each valid conversation POST creates one append-only entry and returns `201`. Lists order createdAt asc then id asc. The UI disables repeated activation while posting; ambiguous network retries may create a second entry and require deliberate user review. Backend conversation request-key replay/deduplication is deferred beyond Lab 3. New entries update Ticket.updatedAt but not Ticket.version.
- **BR-33:** Private notes use a separate model, service projection, endpoint and composer. Requester detail contains no notes, note authors, note counts or note fragments, including errors/exports/traces.
- **BR-34:** Preserve Lab 2 JPG/JPEG, PNG, WEBP, PDF; matching extension/MIME/signature; 5 MiB/file; five active files; UUID private storage; filename sanitization; one file/request; compensating cleanup; reason 5-250 for soft removal. Removed/non-owned downloads are safe `404`.
- **BR-35:** Retain Attachment rows, physical bytes/storageKey, removal reason/time/remover ID and active-count semantics. Operational users read/download active files but do not upload/remove for someone else.
- **BR-36:** Queue search/filters combine with AND; case-insensitive search covers ticketNumber/summary. Exact query fields, allowed sort/page sizes and response metadata are fixed in api-spec.md. Admin listing only needs search and one optional role filter, ordered name asc/id asc without pagination.
- **BR-37:** Unsupported, duplicate, malformed or out-of-range query/body values are safe `400`. Valid pages beyond the end return empty items with accurate pagination. No unsupported feature is silently enabled.
- **BR-38:** Safe errors use the Lab 2 envelope; unexpected 500 includes correlationId and no credentials, paths, stack traces, SQL or private notes. Busy UI prevents repeat clicks; backend transactions/idempotency enforce correctness.
- **BR-39:** Failed saves preserve non-secret editable input and offer recovery; password controls are cleared after credential failure/success, logout or route exit. Never preserve passwords in local/session storage or telemetry.
- **BR-40:** Tests that migrate/seed/write PostgreSQL must use a separately validated TEST_DATABASE_URL and private temporary attachment directory, never fall back to development DATABASE_URL. Pure unit/mock tests remain runnable without a database.

## 6. UI Specification Summary

[ui-spec.md](ui-spec.md) is normative for routes, modes, controls, badges, state feedback and responsive/accessibility behavior. Keep the Lab 2 tokens/spacing and refactor existing App.tsx screens into reusable modules as needed. Never expose unauthorized content while restoring sessions. Requester attachments remain editable actions around read-only submitted Ticket data. Public/Private composers are unmistakably separate.

## 7. Data Model, Migration and Seed Decisions

Existing Prisma/PostgreSQL foundation remains. IDs are positive integer PKs unless stated; DateTime uses the existing PostgreSQL TIMESTAMP(3) convention and UTC API encoding; new FKs use onDelete Restrict except session-to-user cascade. Applied migrations are never edited.

| Model/change | Exact fields and nullability |
| --- | --- |
| User (rename existing RequesterUser table/model) | Preserve id/autoincrement, name VarChar(120), normalized unique email VarChar(254), isActive Boolean, createdAt/updatedAt DateTime. Add role UserRole NOT NULL default REQUESTER; passwordHash TEXT nullable only for unprovisioned accounts; mustChangePassword Boolean NOT NULL default true; passwordChangedAt DateTime nullable; version Int NOT NULL default 1. Add CHECK passwordHash IS NOT NULL OR mustChangePassword=true; version > 0. |
| Session | id UUID PK generated server-side; tokenHash Char(64) unique NOT NULL; userId Int FK User NOT NULL; csrfToken Char(64) NOT NULL (random 32-byte hex); createdAt/lastSeenAt/expiresAt DateTime NOT NULL. Store no raw session token. Restricted session: createdAt=lastSeenAt at issuance, expiresAt=createdAt+15 minutes and lastSeenAt never changes. Normal session: expiresAt=createdAt+8 hours and lastSeenAt supports the 30-minute idle check without extending expiresAt. |
| Login throttle | Bounded process memory per BR-14; no PostgreSQL LoginThrottle table or account-history feature in Lab 3. Restart clears counters, which is a documented local-lab limitation. |
| Ticket additions | ticketOwnerId Int nullable FK User; itPriority RequestedPriority NOT NULL, backfilled from requestedPriority; version Int NOT NULL default 1; resolutionSummary VarChar(2000) nullable; resolvedAt/closedAt/requesterResolvedAt DateTime nullable; requesterResolvedById Int nullable FK User; lastStatusReason VarChar(250) nullable. Preserve every existing Ticket field and requesterId FK, now referencing User. CHECK version > 0 and Requester-indication timestamp/author are both null or both non-null. |
| TicketOwnerChange | id Int autoincrement PK; ticketId Int FK Ticket NOT NULL; previousOwnerId Int nullable FK User; nextOwnerId Int nullable FK User; actorId Int FK User NOT NULL (Staff/Admin who assigned or Admin who edited the account); changedAt DateTime NOT NULL default now; reason TicketOwnerChangeReason enum NOT NULL (`ASSIGNED`, `REASSIGNED`, `ACCOUNT_INELIGIBLE`). Enforce combinations: ASSIGNED has null previous/non-null next; REASSIGNED has distinct non-null previous/next; ACCOUNT_INELIGIBLE has non-null previous/null next. Append-only provenance, not a new UI screen or full account-history feature. |
| PublicComment | id Int autoincrement PK; ticketId Int FK Ticket NOT NULL; authorId Int FK User NOT NULL; content VarChar(5000) NOT NULL; createdAt DateTime NOT NULL default now. |
| InternalNote | Same fields/types/constraints as PublicComment in a separate table. |
| Attachment | Preserve existing fields and removal CHECK. Keep removedByRequesterId as the compatibility field name, now FK User; only a Requester owner writes removal. Preserve attachment ticket FK and all storage values. |
| Category/RelatedSystem/sequence | No destructive changes; preserve IDs, activation and TicketNumberSequence position. |

Enum UserRole has REQUESTER/IT_STAFF/ADMINISTRATOR; extend TicketStatus with the seven added values. Add TicketOwnerChangeReason with the three values above. Existing RequestedPriority enum is reused for both priorities.

Retain existing owner/filter indexes and normalized-email CHECK. Rename User table constraints/indexes/sequence as needed to match Prisma without resetting ID allocation. Add User(role,isActive), Session(userId) and Session(expiresAt); Ticket(ticketOwnerId,updatedAt,id), Ticket(currentStatus,itPriority,updatedAt,id), Ticket(updatedAt,id), Ticket(requesterResolvedById); TicketOwnerChange(ticketId,changedAt,id) and previousOwnerId/nextOwnerId; each conversation (ticketId,createdAt,id) and (authorId). Foreign keys and uniqueness are database-enforced; active-role/last-admin/transition checks are service-enforced within transactions. Verify index needs against queries rather than adding an unbounded filter-index set.

### Forward migration and initial-password provisioning

1. Before migration, use an operator-owned database/attachment backup and record row counts, IDs, owner/remover links, numbers, sequence position and sample file hashes. Exercise the procedure first on an isolated copy; this contract task does not alter the live database.
2. Commit new migrations that extend enums, rename RequesterUser to User (not drop/recreate), preserve all FK references/IDs, add the above models/columns including TicketOwnerChange, and backfill role=REQUESTER, mustChangePassword=true and IT Priority. Keep original activation. passwordHash starts NULL: no user can login unprovisioned. Existing Lab 2 Tickets start with no owner and therefore need no synthetic owner-change rows.
3. Implement `npm --prefix server run lab3:provision-migrated-users` as a local interactive CLI. For each User with passwordHash=NULL, generate a fresh random 16-byte value encoded as 32 hex characters; hash it per BR-09; conditionally save hash/mustChangePassword=true in a transaction. Show email and initial password once to the operator only after commit, in an interactive TTY with no redirected output/logging. The operator privately supplies it to that account. Reruns skip already provisioned users, including changed passwords, and never activate inactive accounts. If delivery is lost, use Administrator reset; do not recover plaintext from storage.
4. Seed new demo users/fixture Tickets/conversations by stable unique keys; use LAB_SEED_INITIAL_PASSWORD (synthetic local/test value, satisfying BR-08) only on creation of new fixture accounts. Never overwrite existing hash, mustChangePassword, role, activation, Ticket ownership/status/priority or conversations on reruns. Do not run the old Lab 2 seed to reset migrated accounts.
5. Use the real User autoincrement sequence for new accounts after migration; verify it is ahead of the maximum preserved ID. Keep Ticket-number allocation continuous. Preserve existing clientRequestId/requestPayloadHash replay behavior across migration.
6. Remove selector UI/helper/endpoint and clear legacy `toktickit.requesterId` at startup if present. Requests use cookie credentials, not requester arguments/headers. Historical selector tests are retired explicitly, while Ticket/Attachment tests are adapted to authenticated fixtures.
7. Verify before/after integrity, first login, idempotent provisioning/seed, unchanged file bytes/removal attribution and Requester A/B isolation. Recovery is restore of the operator backup; never use migrate reset on the existing project database.

### Seed requirements and chosen fixtures

- Keep existing Requester identities (Anan, Benjamas, Chaiwat, Daranee and Inactive Requester); retain existing states.
- Ensure fixture creation provides at least 4 active/1 inactive Requester, 3 active/1 inactive IT Staff and 1 active Administrator in a fresh local/test database. Proposed added emails: support.one@example.test, support.two@example.test, support.three@example.test, inactive.support@example.test and admin@example.test.
- At least 24 fixture Tickets: all 8 statuses, all 4 priorities, assigned/unassigned and different Requesters, with safe example Comments/Notes. Terminal-state fixtures satisfy resolution/reason fields. Creation respects existing numbering/idempotency; reseeding does not rewind the sequence or overwrite work.
- Document local fixture emails, initial-password environment input, first-change behavior and CLI/manual delivery in runtime README during implementation. Use only synthetic credentials; mask them in evidence and exclude .env, logs, uploaded files and sensitive traces from Git.

## 8. API Contract

[api-spec.md](api-spec.md) fixes every endpoint, request/response type, status code, cookie/session/CSRF behavior and validation. Existing Requester resource paths stay; authentication changes intentionally replace the temporary header contract. New staff paths separate queue/detail from requester-scoped routes; conversation/attachment reads share explicit role-aware access checks.

## 9. Acceptance Criteria

- **AC-01:** Active valid login returns safe identity and a new session; wrong, missing, inactive and unprovisioned credentials cannot authenticate and have uniform feedback.
- **AC-02:** Initial-password login cannot access normal screens/APIs until a valid replacement is saved. A restricted session is valid just before its issuance+15-minute expiresAt, activity does not extend or update it, and at or after expiresAt me/change-password return `401` while logout returns `204`.
- **AC-03:** Password policy boundaries, exact confirmation/current-password checks, unique salts and hashed storage are enforced. Password/User update, deletion of all old sessions and insertion of one replacement normal session commit atomically; any database-step failure rolls all three back. Set-Cookie is emitted only after commit. If response delivery fails after commit, the user can recover by logging in with the new password and no old session remains valid.
- **AC-04:** Current-user restoration displays correct identity/role without protected-content flash; expired/missing/inactive/revoked sessions fail closed.
- **AC-05:** Logout invalidates a present server token, clears cookie/UI account state and prevents protected access; repeated or absent/expired-session logout returns empty `204`, while a valid-session request with invalid CSRF returns `403` without deleting the session.
- **AC-06:** Every protected matrix operation denies unauthorized roles; spoofed requester header/body/query cannot return or mutate another Requester's resources.
- **AC-07:** Forward migration preserves historical IDs, activation, Ticket/removal links, numbers, idempotency, reference data and Attachment bytes.
- **AC-08:** Provisioning and twice-run seed meet fixture minima without duplicates, password resets, reactivation, lost work or sequence rewind; migrated accounts must change initial passwords.
- **AC-09:** Authenticated Ticket creation retains validation, official number/date, NEW, default IT Priority and request-ID replay/conflict; My Tickets/detail show only owned submissions.
- **AC-10:** Authenticated Requester Attachment lifecycle retains type/signature/size/count, compensating cleanup, download bytes, soft removal and safe non-owner/removed denial.
- **AC-11:** Selector, Change Requester and identity storage/headers disappear from the runtime; obsolete selector expectations are identified separately from preserved regression tests.
- **AC-12:** Queue supports documented AND search/filter, ordering, tie-breaking, page sizes and accurate metadata; invalid queries are 400 and valid beyond-end pages are empty.
- **AC-13:** Queue UI presents realistic assigned/unassigned data, accessible badges, open action and distinct loading/empty/no-results/forbidden/failure behavior with recovery.
- **AC-14:** Operational detail preserves read-only submitted values, both priorities, current owner/status, indication and Attachment continuity with role-specific controls.
- **AC-15:** Claim/assign/reassign allow only eligible current owners and reject another owner's claim, null/manual-unassign requests, terminal staff mutation and concurrent/stale writes; account-driven cleanup is the only path that clears terminal/current owners and preserves append-only attribution.
- **AC-16:** IT Priority can change through permitted roles while Requested Priority remains intact; invalid priorities and stale/terminal updates are rejected.
- **AC-17:** Every allowed/forbidden transition follows the matrix; confirmation, public resolution/reopen/cancel inputs and backend timestamps/reset rules are enforced without Actions Taken.
- **AC-18:** Requester indication is owner/eligible-state restricted, records backend identity/time, is repeat-safe and does not formally resolve/close.
- **AC-19:** Public Comments validate boundaries, author/time and append-only behavior; owned Requesters and operational roles read them in deterministic order. Busy UI blocks double-clicks; a user reviews an ambiguous retry before re-posting.
- **AC-20:** Internal Notes are operational-only, append-only and safe; direct Requester API requests and all Requester response projections reveal no note data/counts.
- **AC-21:** Public/Private composers are visibly separate; text/script-like content renders inert and failed posts preserve non-secret drafts with clear ambiguity feedback before a manual retry.
- **AC-22:** Admin list/search/optional role filter returns Name/Email/Role/Status/Edit with documented order and meaningful feedback; non-admin access is forbidden.
- **AC-23:** Admin create/edit validates name/email/one role/activation, enforces normalized uniqueness including inactive users and handles stale edits safely.
- **AC-24:** Deactivation/demotion/reset/account edits revoke affected sessions and unassign owners losing eligibility even on terminal Tickets; TicketOwnerChange retains former owner/actor/time while status, submitted Ticket data and historical requester/authorship/removal links remain unchanged.
- **AC-25:** Self-deactivation and last-active-admin loss are blocked, including simultaneous edits; unrelated permitted account edits succeed.
- **AC-26:** Initial-password reset stores no plaintext/response password, requires next-login change, revokes sessions and provides deliberate UI confirmation.
- **AC-27:** Exact-origin CORS/login protection, CSRF checks on JSON/multipart writes, cookie flags, expiry/rotation and rate-limit thresholds behave as contracted.
- **AC-28:** Async forms/list/detail/account actions show busy and safe validation/401/403/404/409/429/500 feedback; no SQL, paths, credentials or private notes leak.
- **AC-29:** All major screens follow Zen Green at desktop/tablet/mobile, 360px and 200% zoom without clipped/overlapping controls or page overflow.
- **AC-30:** Keyboard-only operation, focus return/first-invalid focus, semantic labels/dialogs/live regions and readable text-bearing badges are verified.
- **AC-31:** A final-main release audit references actual passing evidence for each planned UNIT, PERF, API, DB, UI, STYLE, A11Y, E2E, RESP and VIS test group plus preserved Lab 1/2 regression, builds, migration/seed and security checks. It records the verified revision, command/output paths, counts and skips; no required failure/skip or fabricated result is accepted.
- **AC-32:** Issues, feature-to-staging-to-main history, genuine peer review, actual AI prompts/reflection and one readable PDF with Answer Part 1-9 provide the required evidence.

Every AC maps to planned tests in [tests.md](tests.md); each implementation Issue identifies its ACs and evidence.

## 10. Product Definition of Done

- [ ] Student/peer reviews the consistent specification/API/UI/test plan before main implementation completion; real approval is recorded.
- [ ] All FR/BR/AC and authorized scope are implemented; exclusions remain respected.
- [ ] Fresh install, forward migration, account provisioning and repeated seed are documented and verified without historical data loss.
- [ ] Authentication/password change/session expiry/logout and the complete backend authorization matrix pass direct API tests.
- [ ] All preserved Requester functions and new staff/account workflows work at required widths and through keyboard operation.
- [ ] No secrets/plaintext passwords/uploads/sensitive traces are committed; ignore rules cover new storage and test artifacts.
- [ ] All required tests/builds pass on isolated PostgreSQL; zero required skips; planned/actual paths and status are updated truthfully.
- [ ] Screenshots and manual visual checklist verify design, focus, labels, overflow and role boundaries.
- [ ] Each Issue links its reviewed feature PR; feature branches integrate into lab3-staging and a reviewed release promotes to main; Project Issues are Done.
- [ ] Final main tests, builds, migration/regression and evidence record revision, commands, environment and results; rerun affected checks if source changes.
- [ ] reviewer.md contains actual reviewer identity, PR comments/responses/approvals; ai-use.md contains actual 6-10 selected prompts and the student's own reflection.
- [ ] One concise PDF presents Answer Part 1-9 in order with working links and readable screenshots; repository/final main remains source of truth.

Prepared contract completion does not mean Lab 3 product completion. The coding agent may report product completion only when this checklist and all ACs are satisfied.

## 11. Assumptions, Decisions and References

Scope review after PR #68 feedback: authentication, role/ownership enforcement, first-password change, data preservation, Staff queue/operations, public/private separation and minimal Admin management are handout-required. Opaque database sessions, per-session CSRF, local throttle limits, absolute/idle expiry, concurrency versions, public resolution summary/reasons and one-time provisioning CLI are project choices that make those required workflows testable and safe; because they remain in BR/AC, they are Product DoD commitments. To keep the sprint focused, persisted/distributed throttle storage and backend conversation request-key idempotency were removed from Lab 3; no LoginThrottle table, conversation replay API or account-history screen is required. TicketOwnerChange is the minimal internal provenance needed when a terminal owner's account becomes ineligible; it has no UI/API list screen. Scrypt cost is a proposal subject to PERF-01 before auth coding. Any other project choice may be changed only by a reviewed contract update before dependent implementation, not silently weakened to match code.

Security guidance consulted 2026-09-15: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) for memory-hard hashing; [Node.js crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html) for scrypt/randomness/comparison; [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) for session/cookie/write protection. Exact policy values and architecture are our implementation decisions, not claims that the handout specified them.
