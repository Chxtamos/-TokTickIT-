# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Deliver a professional, responsive Requester-facing TokTickIT MVP. A selected Development Requester can create an IT support Ticket, receive a backend-generated official Ticket Number, locate and inspect only their own Tickets, and manage permitted Attachments. The sprint extends the Lab 1 React, Express, Prisma, and PostgreSQL foundation while establishing reusable Zen Green UI and evidence-driven engineering conventions.

## 2. Stakeholder Request Interpretation

Lab 2 replaces the Lab 1 connectivity demonstration with a complete Requester workflow. Real authentication is deferred to Lab 3, so a tester first selects one seeded active Development Requester. That temporary identity becomes the context for Ticket creation, My Tickets, owned Ticket Detail, and Attachment operations. Completion requires working software plus an approved specification, traceable tests, GitHub Issues, feature branches, peer-reviewed Pull Requests, visual inspection, and final evidence.

## 3. Scope

### Included

- Development Requester Selection and Change Requester flows.
- Active Requester, Category, and Related System data loaded from PostgreSQL.
- Create Ticket with a backend-generated Ticket Number and initial `NEW` status.
- My Tickets containing only the selected Requester's Tickets.
- Search, filtering, sorting, and pagination.
- Requester-owned, read-only Ticket Detail.
- Attachment upload, metadata, download, and soft removal with a reason.
- Backend ownership checks for direct Ticket and Attachment requests.
- Initial, loading, submitting, success, validation, empty, no-results, and safe failure states.
- Reusable Zen Green UI, responsive layouts, and accessibility behavior.
- Unit, API/integration, UI component, UI style, responsive, visual, and E2E evidence.
- GitHub Issues, feature branches, PR review, staged integration, documentation, and final submission evidence.

### Excluded

- Real login/logout, passwords, password hashing, sessions, tokens, authenticated identity, and production role-based authorization.
- IT Staff dashboard/queue, claiming, reassignment, and changing IT Priority.
- Public Comments, Internal Notes, Actions Taken/Service Actions, and Event Log features.
- Ticket status transitions after the initial `NEW` state, including resolve, close, reopen, or cancel.
- Resolution confirmation and resolution-summary workflows.
- Administrator screens for users, roles, Requesters, Categories, or Related Systems.
- Production deployment, malware scanning, email notifications, and cloud object storage.

The sample Ticket Detail image is a visual-direction reference only. Features visible in the image but explicitly excluded above must not be implemented in Lab 2.

## 4. Functional Requirements

### Development Requester Context

- **FR-01:** When no valid Requester is selected, the application shall show the Development Requester Selection screen before any requester-specific screen.
- **FR-02:** The selector shall load only active Development Requesters from PostgreSQL and provide loading, empty, and safe failure states.
- **FR-03:** Continue shall remain disabled until an active Requester is selected.
- **FR-04:** The selected Requester ID shall be stored in browser `sessionStorage` for the current tab and revalidated when the application starts.
- **FR-05:** The application shell shall display the selected Requester's name and provide a Change Requester action.
- **FR-06:** Changing Requester shall clear requester-owned client state and reload data in the new context.

### Ticket Creation

- **FR-07:** Create Ticket shall display pending/read-only Ticket Number and Ticket Date fields and the selected Requester as read-only.
- **FR-08:** Active Categories and Related Systems shall be loaded from PostgreSQL.
- **FR-09:** A Requester shall enter Category, Related System, Summary, Requested Priority, Description, and zero to five permitted Attachments.
- **FR-10:** Frontend validation shall provide field-level feedback, and backend validation shall independently enforce the approved rules.
- **FR-11:** The backend shall create the Ticket for the selected Requester, generate a unique Ticket Number, set status to `NEW`, and return authoritative saved values.
- **FR-12:** Duplicate Ticket creation shall be prevented using a client-generated request ID as well as a busy/disabled Submit control.
- **FR-13:** A failed create request shall preserve editable form values and selected valid files.
- **FR-14:** After Ticket creation, selected files shall upload individually. Failed file uploads shall not roll back the Ticket and shall be retryable.

### My Tickets

- **FR-15:** My Tickets shall return and display only Tickets owned by the selected Requester.
- **FR-16:** Search shall support official Ticket Number and Summary.
- **FR-17:** Filters shall support Category, Related System, Requested Priority, and Current Status.
- **FR-18:** The list shall support documented sorting with deterministic secondary ordering.
- **FR-19:** The list shall support one-based pagination and documented page sizes.
- **FR-20:** My Tickets shall have distinct loading, empty, no-results, invalid-query, and safe failure states.
- **FR-21:** Each listed Ticket shall provide a clear action to open Ticket Detail.

### Ticket Detail and Attachments

- **FR-22:** Ticket Detail shall display the owned Ticket as read-only information.
- **FR-23:** A direct request for a missing or non-owned Ticket shall not return Ticket data.
- **FR-24:** Ticket Detail shall list active and removed Attachment metadata and distinguish their states.
- **FR-25:** The owner shall be able to upload a permitted Attachment while fewer than five active Attachments exist.
- **FR-26:** The owner shall be able to download an active Attachment.
- **FR-27:** The owner shall be able to soft-remove an active Attachment after confirmation and entry of a valid reason.
- **FR-28:** A removed Attachment shall retain metadata but shall not be previewable, downloadable, or removable again.
- **FR-29:** Direct operations on another Requester's Attachment shall return no metadata, bytes, or mutation.

### Presentation and Feedback

- **FR-30:** All screens shall follow `ui-spec.md`, be keyboard-operable, and work at desktop, tablet, and mobile widths without page-level horizontal scrolling.
- **FR-31:** All asynchronous actions shall have visible loading/busy feedback and prevent repeated activation.
- **FR-32:** User-facing errors shall be safe and actionable; internal exception details shall remain server-side.

## 5. Business Rules

### Identity and Ownership

- **BR-01:** The official Ticket Number is generated by the backend and must be unique.
- **BR-02:** A new Ticket begins with Current Status `NEW`.
- **BR-03:** Development Requester Selection is a Lab 2 testing mechanism and is not authentication.
- **BR-04:** Only active Requesters may be selected or create new Tickets.
- **BR-05:** The frontend sends the temporary selected identity through `X-Requester-Id`; the backend validates that it identifies an active Requester.
- **BR-06:** `requesterId` is not an editable Ticket field. The backend derives ownership from the validated Requester context.
- **BR-07:** A Ticket or Attachment may be accessed only when owned by the selected Requester.
- **BR-08:** Missing and non-owned Ticket/Attachment resources use the same safe `404` response to avoid exposing another Requester's resource existence.
- **BR-09:** Changing Requester clears owner-specific cached results and confirms before discarding a dirty Create Ticket form.
- **BR-10:** A saved selection that no longer identifies an active Requester is cleared and the selector is shown.

### Ticket Values and Validation

- **BR-11:** Ticket Number format is `TKT-YYYY-NNNNNN`; `YYYY` is the server UTC creation year and `NNNNNN` is a zero-padded PostgreSQL sequence value. Sequence gaps are permitted.
- **BR-12:** Ticket Date is the backend UTC `createdAt`; the UI may format it in the user's local timezone.
- **BR-13:** Category and Related System must exist and be active at submission time.
- **BR-14:** Requested Priority is one of `LOW`, `MEDIUM`, `HIGH`, or `URGENT`; the UI defaults to `MEDIUM`.
- **BR-15:** Summary is required, trimmed, and 5-120 characters after trimming.
- **BR-16:** Description is required, trimmed, and 10-5,000 characters after trimming.
- **BR-17:** Whitespace-only values are invalid. Internal whitespace and line breaks are preserved.
- **BR-18:** Backend response/database values are authoritative for Ticket Number, Ticket Date, Requester, status, and saved fields.
- **BR-19:** Each create attempt contains a UUID `clientRequestId`; `(requesterId, clientRequestId)` is unique.
- **BR-20:** A replay with the same Requester, request ID, and normalized payload returns the existing Ticket without duplication. Reusing the ID for different content returns `409`.

### Search, Filter, Sort, and Pagination

- **BR-21:** Search is case-insensitive and matches Ticket Number or Summary after trimming.
- **BR-22:** Search and active filters are combined using logical AND.
- **BR-23:** Supported filters are Category ID, Related System ID, Requested Priority, and Current Status.
- **BR-24:** Supported sort fields are `createdAt`, `updatedAt`, and `ticketNumber`; directions are `asc` and `desc`.
- **BR-25:** Default order is `updatedAt desc`, then `id desc`; other sorts also use a stable ID tie-breaker.
- **BR-26:** Pagination is one-based. Default page size is 10; allowed sizes are 10, 20, and 50.
- **BR-27:** Invalid query values return `400`. A valid page beyond the final page returns an empty array with accurate metadata.
- **BR-28:** Empty state means the Requester owns no Tickets; no-results means current search/filters match none.

### Attachment Rules

- **BR-29:** Allowed types are JPG/JPEG, PNG, WEBP, and PDF.
- **BR-30:** Maximum size is 5 MiB (5,242,880 bytes) per file.
- **BR-31:** A Ticket has at most five active Attachments; removed records do not count toward the limit.
- **BR-32:** Acceptance requires an allowed extension, MIME type, and matching file signature.
- **BR-33:** Original filenames are sanitized for display: path separators, control characters, and reserved filename characters are replaced with `_`, and the result is truncated to 255 Unicode code points while preserving its extension. Storage names are generated UUIDs and never use the client path.
- **BR-34:** Files are stored outside the public web root; download always passes through ownership and active-state checks.
- **BR-35:** Upload accepts one file per request. Any file written before a metadata failure is removed as compensation.
- **BR-36:** Removal is soft removal using `removedAt`, `removedReason`, and `removedByRequesterId`.
- **BR-37:** Removal reason is required, trimmed, and 5-250 characters.
- **BR-38:** Removed metadata retains filename, type, size, upload time, removal time, and reason, but has no preview/download action.
- **BR-39:** Removed or non-owned downloads return the safe `404` response.
- **BR-40:** If Ticket creation succeeds but an Attachment upload fails, the Ticket remains saved and the UI offers a retry path.

### Error and State Rules

- **BR-41:** Validation errors use the shared safe API error envelope; stack traces, SQL details, filesystem paths, and secrets are never returned.
- **BR-42:** Failed Ticket creation preserves editable form values; a successful response clears those values only after confirmation is shown.
- **BR-43:** Busy controls prevent repeated UI activation but do not replace backend idempotency and validation.
- **BR-44:** Reference data that becomes inactive after page load is rejected by the backend and reloaded by the UI.
- **BR-45:** Lab 3 may replace the temporary Requester header with authenticated identity while preserving `Ticket.requesterId` ownership.

## 6. UI Specification Summary

- Use the Zen Green tokens and reusable shell defined in `ui-spec.md`.
- Clearly label the Requester selector as testing-only and not login.
- Distinguish editable, read-only, invalid, disabled, focused, and busy controls.
- Use a desktop Ticket table and equivalent mobile cards.
- Keep Ticket Detail read-only and separate Ticket information from Attachment actions.
- Use text-labelled Requested Priority and Current Status badges.
- Do not implement IT Priority controls; only reserve reusable future styling if needed.
- Never rely on color alone for meaning.

## 7. Data Changes

### Models

| Model | Required fields and constraints |
| --- | --- |
| `RequesterUser` | `id` integer PK; `name` max 120; unique normalized `email` max 254; `isActive` default true; `createdAt`; `updatedAt` |
| `Category` | Existing `id`, unique `name`, `createdAt`; add `isActive` default true and `updatedAt` |
| `RelatedSystem` | `id` integer PK; unique `name`; `isActive` default true; `createdAt`; `updatedAt` |
| `Ticket` | `id`; unique non-null `ticketNumber`; owner/category/system FKs; `summary`; `description`; priority/status enums; `clientRequestId`; `requestPayloadHash`; timestamps; unique `(requesterId, clientRequestId)` |
| `Attachment` | `id`; `ticketId` FK; `originalName`; unique `storageKey`; `mimeType`; `sizeBytes`; `uploadedAt`; nullable removal fields and remover FK |

### Enums

- `RequestedPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- `TicketStatus`: `NEW` in Lab 2, designed for explicit future migrations.

### Relationships

- One `RequesterUser` owns many Tickets; each Ticket has exactly one Requester.
- One Category and one Related System may relate to many Tickets.
- One Ticket has many Attachments.
- One Requester may be recorded as remover of many Attachments.

### Indexes and Constraints

- Unique: Requester email, Category name, Related System name, Ticket Number, Attachment storage key, and `(requesterId, clientRequestId)`.
- Foreign-key indexes for all relationships.
- Default-list index `(requesterId, updatedAt desc, id desc)`.
- Owner-prefixed filter indexes for Category, Related System, Requested Priority, and Current Status.
- Removal fields must be all null or all populated through service validation and a database check constraint where appropriate.

### Migration and Seed

- Preserve all Lab 1 Category IDs and data; new Category columns receive safe defaults.
- Add a PostgreSQL sequence for Ticket Numbers.
- Seed with `upsert` so repeat execution creates no duplicates.
- Include Categories: Account and Access, Hardware, Software, Network.
- Include at least seven Related Systems: Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, Corporate Laptop.
- Include at least four active and one inactive Development Requester.
- Never commit `.env`, credentials, or uploaded files.

### Justified Database Decision

Ticket ownership is stored as a direct foreign key to `RequesterUser`, not inferred from browser state. This supports indexed owner-scoped queries and enforceable backend checks in Lab 2. Lab 3 can later associate an authenticated account with the same Requester record without rewriting existing Ticket ownership.

## 8. API Contract

The normative contract is `api-spec.md`. It defines active reference-data retrieval, idempotent Ticket creation, owner-scoped list/detail retrieval, Attachment lifecycle, request/response shapes, validation, pagination, status codes, safe errors, and ownership behavior.

## 9. Acceptance Criteria

- **AC-01:** Given no valid selected Requester, when a requester-specific route opens, then the selector is shown and protected content is not rendered.
- **AC-02:** Given active and inactive seeded Requesters, when the selector loads, then only active Requesters are offered.
- **AC-03:** Given the Requester API is loading, empty, or failed, when the selector renders, then the matching accessible state appears.
- **AC-04:** Given Requester A is selected, when Continue is activated, then the shell displays A and requester-specific requests use A's context.
- **AC-05:** Given A is current, when the user changes to B, then A-owned client data is cleared and B-owned data loads.
- **AC-06:** Given Create Ticket opens, when reference data loads, then active Categories/Systems come from the API and Requester is read-only from context.
- **AC-07:** Given invalid or boundary Ticket input, when submission is attempted, then field errors appear and no invalid Ticket is saved.
- **AC-08:** Given valid Ticket data, when submitted, then exactly one Ticket is saved for the selected Requester with backend Ticket Number, date, and `NEW` status.
- **AC-09:** Given a successful request is retried with the same request ID/payload, when received, then no duplicate is created and the original Ticket is returned.
- **AC-10:** Given submission is in progress, when repeated activation is attempted, then the UI remains busy/disabled and backend idempotency prevents duplication.
- **AC-11:** Given a create API failure, when handled, then a safe error appears and editable values remain available.
- **AC-12:** Given a Ticket is created and an Attachment upload fails, when results appear, then the Ticket remains saved and failed files can be retried.
- **AC-13:** Given Requester A owns Tickets, when My Tickets loads as A, then only A's Tickets are returned.
- **AC-14:** Given matching/nonmatching Tickets, when search is used, then Ticket Number/Summary matching is case-insensitive and no-results appears when appropriate.
- **AC-15:** Given valid filter combinations, when applied, then search and all filters use AND semantics.
- **AC-16:** Given a supported sort, when applied, then results use that order with deterministic tie-breaking.
- **AC-17:** Given multiple pages, when pagination/page size changes, then the correct owner-scoped slice and accurate metadata are returned.
- **AC-18:** Given invalid query parameters, when requested, then the API returns safe `400` and the UI offers recovery.
- **AC-19:** Given an owner with no Tickets versus filters with no matches, when rendered, then distinct empty and no-results states appear.
- **AC-20:** Given A owns a Ticket, when A opens it, then approved Ticket fields and Attachment metadata render read-only.
- **AC-21:** Given B directly requests A's Ticket, when ownership is checked, then safe `404` is returned with no A data.
- **AC-22:** Given an allowed file at or below 5 MiB and fewer than five active files, when the owner uploads it, then active metadata and storage are created.
- **AC-23:** Given invalid type/signature, oversize, or a sixth active file, when uploaded, then it is rejected without active metadata.
- **AC-24:** Given an active owned Attachment, when downloaded, then correct bytes, media type, and safe filename are returned.
- **AC-25:** Given an active owned Attachment and valid reason, when removal is confirmed, then removal metadata is stored and active count decreases.
- **AC-26:** Given a removed Attachment, when viewed, then retained metadata/reason appear but download/preview/remove actions do not.
- **AC-27:** Given a removed or non-owned Attachment, when operated on directly, then safe rejection returns no bytes or mutation.
- **AC-28:** Given keyboard-only use, when navigating each screen, then controls, focus, labels, errors, and dialogs are understandable without color alone.
- **AC-29:** Given desktop, tablet, and mobile viewports, when required screens/states are inspected, then no clipping, overlap, hidden action, or page-level horizontal scroll exists.
- **AC-30:** Given final `main`, when documented build/test commands run, then every required non-skipped test passes and every AC maps to evidence.

## 10. Definition of Done

### Product Completion

- [ ] All approved FRs/BRs are implemented without excluded Lab 3 or IT Staff features.
- [ ] Every AC maps to one or more passing tests.
- [ ] Required unit, API, UI, style, responsive, visual, and E2E evidence passes on final `main`.
- [ ] No required test is skipped, disabled, commented out, flaky, or unrelated.
- [ ] Prisma schema, migrations, constraints, indexes, and idempotent seed match the contract.
- [ ] API behavior matches `api-spec.md` and UI matches `ui-spec.md`.
- [ ] Success, invalid, boundary, loading, empty, no-results, ownership, storage, and failure cases are demonstrated.
- [ ] README setup, migration, seed, run, test, and storage instructions are current.
- [ ] No secrets, `.env`, generated build output, or uploaded files are committed.

### Course Delivery

- [ ] GitHub Issues cover specifications, data, API, UI, tests, E2E, visual review, documents, and release.
- [x] `lab2-staging` was created from completed Lab 1 `main`.
- [ ] Every Issue uses a feature branch and peer-reviewed PR into `lab2-staging`.
- [ ] Real reviewer comments, responses, corrections, and approvals are recorded.
- [ ] Release PR `lab2-staging -> main` passes integration tests and review.
- [x] `ai-use.md` contains 6-10 actual prompts and the student's own reflection.
- [ ] Required screenshots are readable under `artifacts/lab-02/screenshots/`.
- [ ] One concise PDF uses `Answer Part 1` through `Answer Part 9` in exact order with working links.

## 11. Assumptions and Decisions Requiring Human Approval

**Human review record (2026-08-24):** The student reviewed and approved the Engineering Contract as written, including the Functional Requirements, Business Rules, Acceptance Criteria, Test Plan, UI Specification, API contract, and decisions D-01 through D-13.

| ID | Proposed decision | Reason | Human decision |
| --- | --- | --- | --- |
| D-01 | Store selected Requester ID in `sessionStorage` | Simulates one tab/session without pretending to be authentication. | Approved |
| D-02 | Send temporary context through `X-Requester-Id`; never accept editable body ownership | Consistent owner context and no body/header mismatch. | Approved |
| D-03 | Return safe `404` for missing and non-owned Ticket/Attachment | Avoids resource enumeration. | Approved |
| D-04 | Use `TKT-YYYY-NNNNNN` from PostgreSQL sequence | Backend-generated, concurrent, unique, readable, testable. | Approved |
| D-05 | Summary 5-120; Description 10-5,000; removal reason 5-250 | Bounded payloads with usable content. | Approved |
| D-06 | Priorities `LOW`, `MEDIUM`, `HIGH`, `URGENT`; UI default `MEDIUM` | Clear Requester choice and future-compatible enum. | Approved |
| D-07 | UUID request ID plus unique database constraint/replay | Covers double-clicks, retries, and concurrent duplicates. | Approved |
| D-08 | Search Ticket Number and Summary only | Meets discoverability without broad Description search. | Approved |
| D-09 | One-based pagination; 10 default; 10/20/50 allowed | Bounded, simple list contract. | Approved |
| D-10 | Upload one Attachment per API request after Ticket creation | Clear per-file outcome and retryable partial failure. | Approved |
| D-11 | Validate extension, MIME, and signature; exact 5 MiB boundary | Prevents simple renamed-file bypasses. | Approved |
| D-12 | Retain removed binary outside public access but block application download/preview | Preserves soft-removal metadata and required unavailable state. | Approved |
| D-13 | No Lab 2 IT Priority workflow; reserve future badge styling only | Avoids excluded IT Staff scope. | Approved |
