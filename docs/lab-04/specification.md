# Lab 4 Sprint Engineering Specification

Contract version: 1.0. Status: specification baseline for Issue #91; implementation is not claimed.

Source: supplied `SE+Lab+4.pdf`. This contract extends the released Lab 3 baseline at `main` commit `319c34c`. Requirements fixed by the handout remain mandatory; concrete values below are project decisions made where the handout intentionally leaves a choice.

## 1. Sprint Goal

Complete the TokTickIT service-desk workflow by adding traceable Actions Taken under Tickets, enforcing the final Ticket lifecycle and resolution gate, providing concise role-appropriate dashboards, and hardening the complete Labs 1-4 product without regressing authentication, authorization, Requester, IT Staff, Administrator, comment, note, or attachment behavior.

## 2. Stakeholder Request

IT Staff need a reliable record of work performed on a Ticket while the primary Ticket Owner continues coordinating the Ticket. Requesters must be able to see work recorded on their own Tickets without editing it. Requesters and operational users need concise dashboards that lead back to detailed screens. The final product must remain one secure, responsive, accessible Zen Green application.

## 3. Scope

Included: Actions Taken data/API/UI; final Ticket transition and resolution rules; Requester and IT Staff dashboards; Administrator reuse of the operational dashboard; migration/backfill/seed; authorization, validation, concurrency, retry safety and safe errors; complete Labs 1-3 regression; responsive/accessibility/visual hardening; staged GitHub integration and final evidence.

Excluded: SLA clocks/escalation/on-call/breach notifications; email/SMS/LINE/push notifications; inventory, spare parts, purchasing and service cost accounting; timesheet/payroll/labor costing; multi-level approvals/e-signatures; advanced BI/report builders/export warehouses; multi-tenant/production cloud work; and any new feature not approved by this contract.

## 4. Functional Requirements

- **FR-01:** Store zero or more Actions Taken under exactly one Ticket and preserve all earlier data.
- **FR-02:** Show all Actions Taken for an owned Ticket to its Requester as read-only information; permit IT Staff and Administrators to create/update Actions Taken on accessible Tickets.
- **FR-03:** Record backend-controlled creation time and creator (`performedBy`) and never trust a client-supplied creator identity; preserve later mutation actors through immutable audit events.
- **FR-04:** An Action Taken records description, result, follow-up-required state, conditional follow-up note, attachment notes, operational status, optional assignee, workflow cycle, version and timestamps.
- **FR-05:** Permit an active IT Staff/Administrator assignee that may differ from the Ticket Owner; reject inactive or ineligible assignees.
- **FR-06:** Support Action Taken lifecycle changes, including assignment, completion and cancellation, with optimistic concurrency, immutable mutation audit events and stable list ordering.
- **FR-07:** Prevent accidental duplicate Action creation caused by repeated submission/network retry.
- **FR-08:** Enforce the final Ticket transition matrix and resolution gate on the backend even when UI controls are bypassed.
- **FR-09:** Keep Requester "problem appears resolved" advisory; it never formally resolves/closes a Ticket.
- **FR-10:** Provide a Requester Dashboard containing only authenticated Requester-owned metrics/recent Tickets and drill-downs.
- **FR-11:** Provide an IT Staff Dashboard with authoritative operational metrics, current-user Actions Taken, recent/urgent Tickets and drill-downs; Administrators may reuse it.
- **FR-12:** Return concise dashboard DTOs rather than full Ticket collections; define calculation, date boundary, empty state and drill-down for every metric.
- **FR-13:** Preserve all approved Labs 1-3 APIs/screens and role/ownership behavior.
- **FR-14:** Preserve Zen Green patterns and provide loading, validation, success, empty/no-results, forbidden, not-found, conflict and safe-failure feedback.
- **FR-15:** Keep all major Lab 4 screens usable by keyboard and on desktop, tablet and mobile without document-level horizontal scrolling.
- **FR-16:** Provide forward migration, recovery documentation and idempotent seed data covering zero/one/many Actions Taken and zero/non-zero dashboard metrics.
- **FR-17:** Test unit, API/PostgreSQL integration, UI, style, responsive, authorization, workflow, migration/regression, performance-smoke and E2E behavior before Product DoD is claimed.
- **FR-18:** Integrate reviewed feature branches into `lab4-staging`, then reviewed staging into `main`, preserving truthful reviewer/AI/test evidence.

## 5. Business Rules and Authorization

### Actions Taken

- **BR-01:** Each Action Taken belongs to exactly one Ticket; a Ticket may have zero or many Actions Taken.
- **BR-02:** Ticket ownership and Action participation are independent. The Ticket Owner coordinates the Ticket; another active IT Staff/Administrator may perform or be assigned an Action.
- **BR-03:** `performedById` means the authenticated user who originally records the Action. It is set by the backend and immutable after creation; it is not reinterpreted as the later completion/cancellation actor.
- **BR-04:** `createdAt` is backend-generated UTC and immutable. UI displays localized date/time while APIs use ISO-8601 UTC.
- **BR-05:** Description is trimmed and required (5-2000 characters). Result is optional while work is pending/in progress and required (5-2000 characters) before completion. Attachment Notes are optional, trimmed, maximum 1000 characters, and are notes only; Lab 4 does not add Action-specific file upload storage.
- **BR-06:** `followUpRequired=true` requires a trimmed Follow-up Note of 5-1000 characters. When false, Follow-up Note is null; clients cannot preserve hidden stale follow-up text.
- **BR-07:** Action status is `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`. New Actions start `PENDING`. Permitted transitions are PENDING -> IN_PROGRESS/COMPLETED/CANCELLED; IN_PROGRESS -> COMPLETED/CANCELLED; COMPLETED and CANCELLED are terminal.
- **BR-08:** Completion requires a non-empty valid Result and no outstanding follow-up requirement. Therefore an Action with `followUpRequired=true` cannot become COMPLETED until follow-up is cleared after the follow-up work is recorded.
- **BR-09:** `assigneeId` may be null or an active IT Staff/Administrator. Create/update rejects inactive, Requester, or missing assignees. Existing historical attribution remains visible if an account later becomes inactive.
- **BR-10:** Action updates use positive `expectedVersion`; successful mutations increment version atomically. Stale writes return `409 VERSION_CONFLICT` with no partial update. Action-specific versioning protects edits to that row, while BR-31 defines parent/child serialization for mutations that can race with Ticket resolution.
- **BR-11:** Action lists use stable ascending order by `createdAt`, then `id`. Updates never reorder historical entries.
- **BR-12:** Actions Taken are never deleted. Editable fields may change while the row remains the same record; creator and creation time remain immutable. Terminal Actions are read-only. Every successful create/update/assignment/status mutation appends an immutable `ActionTakenEvent` in the same transaction with the authenticated actor, event type, resulting Action version, changed field names, relevant status/assignee before/after values, and server timestamp.
- **BR-13:** Action create uses a client-generated UUID `clientRequestId`, unique per Ticket. Repeating the same ID and same normalized payload returns the original Action; same ID with a different payload returns `409 IDEMPOTENCY_CONFLICT`. Authorization and Ticket accessibility checks always occur before any idempotency lookup/result is disclosed. Concurrent identical authorized creates must converge to the same original Action representation rather than leaking a unique-constraint race as a spurious conflict.
- **BR-14:** Requesters may read Actions Taken only through an owned Ticket and cannot create/update them. IT Staff and Administrators may read/create/update Actions on operationally accessible Tickets. Every write is backend-authorized.

### Ticket workflow and resolution

- **BR-15:** Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.
- **BR-16:** IT Staff and Administrators use the final transition matrix below. Requesters cannot directly transition Ticket status.
- **BR-17:** Formal transition to RESOLVED requires the existing Lab 3 resolution summary plus current-cycle work evidence: the Ticket's current `workflowCycle` must contain at least one `COMPLETED` Action with a valid Result, and every Action in that current cycle must be terminal (`COMPLETED` or `CANCELLED`). A CANCELLED Action never counts as positive completion evidence. Historical Actions from earlier workflow cycles do not satisfy the current resolution attempt.
- **BR-18:** Requester resolution indication remains advisory and is not a substitute for BR-17.
- **BR-19:** Existing Lab 3 `expectedVersion` Ticket concurrency remains authoritative for workflow mutations.
- **BR-20:** Existing Lab 3 reasons/confirmation rules remain: CANCELLED and REOPENED require reason; RESOLVED requires resolution summary; CLOSED requires stored resolution summary. A successful transition from RESOLVED or CLOSED to REOPENED atomically increments Ticket `workflowCycle` by one before any new Action can be recorded for the reopened work.

| From | Permitted next status | Required input / gate |
| --- | --- | --- |
| NEW | OPEN, CANCELLED | reason for CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED | reason for CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED | BR-17 + resolution summary for RESOLVED; reason for CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED | BR-17 + resolution summary for RESOLVED; reason for CANCELLED |
| RESOLVED | CLOSED, REOPENED | stored summary for CLOSED; reason for REOPENED |
| CLOSED | REOPENED | reason |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, CANCELLED | reason for CANCELLED |
| CANCELLED | none | terminal |

### Dashboard calculations

- **BR-21:** Dashboard metrics are calculated by PostgreSQL/backend queries from authoritative data, never by downloading all Tickets and counting in the browser.
- **BR-22:** Requester `openTickets` counts owned Tickets whose status is not RESOLVED, CLOSED or CANCELLED. `waitingForRequester` counts owned `WAITING_FOR_REQUESTER`. `recentlyUpdated` returns up to 5 owned Tickets ordered `updatedAt DESC, id DESC`. `recentlyResolved` returns up to 5 owned Tickets with status RESOLVED/CLOSED ordered by `resolvedAt DESC, id DESC`.
- **BR-23:** Staff `unassignedTickets` counts Tickets with null owner excluding RESOLVED/CLOSED/CANCELLED. `myTickets` counts non-terminal Tickets owned by the current user. `byStatus` counts all Tickets by each of the eight statuses. `byItPriority` counts non-terminal Tickets by LOW/MEDIUM/HIGH/URGENT. `recentOrUrgent` returns up to 10 non-terminal Tickets ordered URGENT first, then `updatedAt DESC, id DESC`.
- **BR-24:** Staff `myOpenActions` counts Actions assigned to the current user in PENDING/IN_PROGRESS; `myRecentActions` returns up to 5 Actions performed by or assigned to the current user ordered `updatedAt DESC, id DESC`.
- **BR-25:** Dashboard date/time values are UTC in API payloads and localized only for display. No calendar-day metric is introduced, avoiding ambiguous day boundaries.
- **BR-26:** Zero counts are returned as numeric zero and empty lists as `[]`. Every actionable metric/list entry has a documented Queue/Detail drill-down; zero-count cards remain visible but non-destructive.

### Security, failures and regression

- **BR-27:** Existing Lab 3 session, CSRF/Origin, safe-error, role-first authorization and Requester non-enumeration rules continue unchanged.
- **BR-28:** Unsupported fields/query parameters are rejected; clients cannot set creator identity, creation timestamps, Ticket ownership or privileged role state through Lab 4 endpoints.
- **BR-29:** Recoverable mutation failures keep unsaved form input. Repeated clicks are disabled while a request is in flight, while backend idempotency remains the actual duplicate protection.
- **BR-30:** No Labs 1-3 behavior is removed merely to make Lab 4 tests pass. Obsolete behavior may only be retired if already superseded by the approved earlier contracts.
- **BR-31:** Parent/child concurrency is serialized on the Ticket aggregate. Every Action create/update/status mutation and every Ticket transition to RESOLVED executes in a database transaction that first locks the parent Ticket row (`SELECT ... FOR UPDATE` or Prisma-equivalent raw transaction lock) and then evaluates/mutates current-cycle Actions. Resolve therefore evaluates BR-17 while holding the same parent lock used by concurrent Action mutations; an Action cannot be inserted or changed between the gate check and Ticket status update. Ordinary edits still use Action `expectedVersion` in addition to this parent lock.
- **BR-32:** Reopen cycle attribution is authoritative: Ticket starts at `workflowCycle=1`; each new Action copies the Ticket's current cycle at create time and the Action cycle is immutable. Reopen increments the Ticket cycle in the same workflow transaction. Dashboard history may show all cycles, but resolution logic examines current-cycle Actions only.
- **BR-33:** Idempotency is non-enumerating. Backend authenticates and authorizes the Ticket before checking `(ticketId, clientRequestId)`. Unauthorized/non-owned callers receive the same role/ownership response they would receive without the idempotency key and cannot distinguish whether a matching Action exists.
- **BR-34:** `ActionTakenEvent` is append-only and cannot be edited/deleted through Lab 4 APIs. Create records a `CREATED` event at resultingVersion 1. Later successful edits record `UPDATED`, `ASSIGNED`, `STATUS_CHANGED`, or the minimal applicable event classification; status completion/cancellation records the authenticated mutation actor separately from immutable `performedById`.
- **BR-35:** Event/audit creation is part of the same transaction as the Action mutation. If event insertion fails, the Action mutation rolls back; no successful Action state change may exist without its corresponding audit event.

### Authorization matrix

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Requester Dashboard | Self only | No | No |
| Staff Dashboard | No | Yes | Yes |
| Read Actions Taken | Owned Ticket | Accessible Ticket | Accessible Ticket |
| Create/update Actions Taken | No | Yes | Yes |
| Assign Action | No | Active IT Staff/Admin target | Active IT Staff/Admin target |
| Ticket status transition | No | Yes | Yes |
| Problem Appears Resolved | Owned eligible Ticket | No | No |

## 6. UI Specification Summary

`ui-spec.md` is normative for UI details. Add Dashboard navigation according to role. Staff Dashboard uses concise metric cards plus recent/urgent work and current-user Actions. Requester Dashboard shows only owned attention/recent work and links to existing My Tickets/Detail. Ticket Detail gains an Actions Taken section with stable list/table, create and view/edit modes. Requester mode is read-only. Existing Zen Green tokens/components, visible focus, semantic labels, non-color status cues and responsive conventions remain mandatory.

## 7. Data Changes

Add Ticket `workflowCycle Int @default(1)`. Add `ActionTaken` with: id, ticketId, workflowCycle, performedById, assigneeId?, description, result?, followUpRequired, followUpNote?, attachmentNotes?, status, clientRequestId, requestPayloadHash, version, createdAt, updatedAt. Add append-only `ActionTakenEvent` with actionId, actorId, eventType, resultingVersion, changedFields, fromStatus?, toStatus?, previousAssigneeId?, nextAssigneeId?, createdAt. Add Ticket/User relations plus indexes supporting Ticket+cycle history, assignee work, performer history, audit lookup and dashboard ordering.

**DB decision 1:** use an Action-specific `version` for stale-write detection on ordinary Action edits, but serialize every Action mutation and RESOLVED transition on the parent Ticket row. This avoids false version conflicts between unrelated child rows while still making the cross-record resolution invariant atomic.

**DB decision 2:** persist `clientRequestId` plus payload hash with a unique `(ticketId, clientRequestId)` constraint. UI busy state alone cannot protect against transport retry; database-backed idempotency can.

**DB decision 3:** use explicit integer `workflowCycle` on Ticket and immutable copied cycle on Action rather than inferring cycles from timestamps/status history. This makes the reopen boundary queryable and prevents earlier completed work from satisfying a later resolution attempt.

**DB decision 4:** store immutable `ActionTakenEvent` rows for mutation actors rather than changing `performedById`. The creator remains historically stable while assignment/edit/completion/cancellation actors remain auditable.

Migration is forward-only and additive: no existing table/row is deleted. Existing Tickets are backfilled/defaulted to `workflowCycle=1`; because Lab 3 has no Actions Taken, there are no pre-Lab-4 Action rows requiring ambiguous cycle attribution. Legacy Tickets therefore remain valid with zero current-cycle Actions and cannot resolve under the new gate until current-cycle work is recorded. Recovery uses database backup/restore or a reviewed corrective forward migration rather than a destructive automatic down migration. Seed uses stable natural fixture keys/upsert behavior and never overwrites real existing work/credentials.

## 8. API Contract

Exact routes, DTOs, validation, statuses and safe errors are defined in `api-spec.md`. Lab 4 adds Action create/update/read and Requester/Staff dashboard reads while preserving approved Labs 2-3 APIs. All writes retain session + Origin + CSRF protection and concurrency/idempotency rules.

## 9. Acceptance Criteria

- **AC-01:** Given permitted operational staff and valid input, creating an Action stores it under the correct Ticket with backend creator/time and returns it once.
- **AC-02:** Repeating the same authorized Action create request ID/payload does not create a duplicate; concurrent identical creates converge to one Action; conflicting authorized reuse is rejected; unauthorized/non-owned callers receive no idempotency existence signal.
- **AC-03:** Requesters can read Actions on owned Tickets but cannot create/update them or read another Requester's Ticket Actions.
- **AC-04:** Only an active IT Staff/Administrator may be assigned; inactive/ineligible assignees are rejected safely.
- **AC-05:** Action validation enforces required description/result/follow-up rules and terminal-state behavior.
- **AC-06:** A stale Action update returns conflict and does not overwrite newer data.
- **AC-07:** Actions remain in stable order and creator/creation time remain immutable after edits; every successful mutation has a matching immutable audit event with the authenticated actor and resulting version.
- **AC-08:** Ticket resolution is rejected with no partial write when the current workflow cycle has no COMPLETED Action, when any current-cycle Action is non-terminal, or when the completed work lacks a valid Result; CANCELLED-only and historical-cycle Actions cannot satisfy the gate.
- **AC-09:** Only final permitted Ticket transitions succeed and Requester indication never changes formal status.
- **AC-10:** Requester Dashboard returns only authenticated-owner counts/recent items with correct zero/empty behavior and drill-downs.
- **AC-11:** Staff Dashboard returns accurate unassigned/my/status/priority/current-action/recent-or-urgent metrics and drill-downs from authoritative backend queries.
- **AC-12:** Administrator can use the Staff Dashboard and operational Action behavior without weakening Administrator account-management authorization.
- **AC-13:** Migration preserves Labs 1-3 data; legacy Tickets with zero Actions work; seed is idempotent and supplies required demonstration states.
- **AC-14:** Representative Labs 1-3 authentication, ownership, attachments, comments, notes, staff workflow and Administrator management regressions pass.
- **AC-15:** Lab 4 UI provides required loading/validation/success/empty/forbidden/conflict/not-found/safe-failure states and preserves recoverable form input.
- **AC-16:** Major Lab 4 screens pass required responsive, keyboard/focus, semantic-label and no-horizontal-overflow checks.
- **AC-17:** Final unit/API/PostgreSQL/UI/workflow/regression/E2E/build checks pass on reviewed staging and final main with no required test silently skipped.
- **AC-18:** Git history proves Issue branches -> reviewed `lab4-staging` -> reviewed `main`, with truthful reviewer, AI-use and final evidence records.
- **AC-19:** Reopening a resolved/closed Ticket increments workflowCycle; old Actions retain their prior cycle and a second resolution requires new current-cycle completed work.
- **AC-20:** Concurrent Action mutation/create and Ticket resolution serialize on the parent Ticket so the resolution decision observes one atomic current-cycle state.
- **AC-21:** Action completion/cancellation/reassignment/edit records the real mutation actor in immutable ActionTakenEvent history without changing performedById.
- **AC-22:** Migration/backfill initializes existing Tickets to workflowCycle 1 without losing Labs 1-3 data and leaves zero-Action legacy Tickets valid but not resolution-ready.

## 10. Product Definition of Done

- Contract documents existed before dependent implementation PR completion and remain internally consistent.
- Every AC maps to at least one planned test in `tests.md`; final results record actual paths/statuses.
- All required Actions Taken, workflow and dashboard behavior is implemented with backend authorization.
- Forward migration and idempotent seed pass on an isolated PostgreSQL test database without losing earlier data.
- Required Labs 1-3 regression, Lab 4 automated tests, builds and E2E pass on the release revision.
- Desktop/tablet/mobile responsive and accessibility evidence is captured; human review is recorded as human review and is never fabricated by an AI agent.
- No known console errors, broken links, placeholder/unfinished controls, committed secrets or unsafe error leaks remain.
- README/setup/migration/seed/test/demo instructions are current.
- Feature PRs are reviewed into `lab4-staging`; final staging is reviewed and merged into `main`; exact-final-main verification is recorded before completion.
- Final Part 1-9 submission evidence is traceable to repository/main truth.

## 11. Assumptions and Decisions

The handout's final rubric explicitly requires Action assignment, status transition, completion, cancellation and inactive-assignee rejection even though the earlier field list is shorter. This contract therefore models assignee and Action status as required Sprint 4 decisions. "Attachment Notes" is treated as textual guidance referencing relevant files, not a new Action-specific upload subsystem. Administrator reuses the IT Staff dashboard because the handout explicitly permits that behavior. Exact numeric validation limits and idempotency/concurrency mechanics above are project decisions and must be peer-reviewed with this contract before dependent implementation.
