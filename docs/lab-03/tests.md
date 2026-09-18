# Lab 3 Test Plan and Traceability

Version 1.0, planned 2026-09-15 before Lab 3 implementation. Rows remain **Planned / Not run** until an implementation PR records reproducible evidence; rows marked below have reproducible evidence from PR #70, PR #71 or PR #72. A marked row records the executed coverage while any unlisted parameterized cases remain part of the planned matrix.

## 1. Baseline, execution and isolation

Current local main `439ee7e` implements Lab 2. Its historical README/tests record 62 server, 54 client and 9 E2E passes; these were not rerun for this documentation task and do not prove Lab 3 completion. Existing unit/API tests use Vitest/Supertest, UI tests React Testing Library, and E2E Playwright in client/e2e/lab-02. The Lab 3 foundation now requires an explicit isolated TEST_DATABASE_URL for PostgreSQL and Playwright integration runs; missing configuration fails closed instead of falling back to a development database.

All database-writing tests use required TEST_DATABASE_URL validated as PostgreSQL, a database name containing `test`, and a different host/port/database from DATABASE_URL. A different schema inside the development database is rejected; database isolation is required. No credential/query-order trick can bypass equality checks; guard errors omit connection URLs. Set the test URL before Prisma initialization; no development fallback. Migrate/seed only the validated target; test fixture creation/cleanup uses run-specific markers and a dedicated temporary Attachment directory. Pure unit/mock tests run without database configuration. Full verification must fail if a required database suite would skip; it cannot report a skipped suite as passing.

Migration tests create a Lab 2 schema on the isolated target using committed historical migrations, populate representative Tickets/Attachments/removal records and run new forward migrations; compare row/ID/FK/sequence/file hashes. Never migrate reset, truncate or clean up the user's development database. Seed twice and repeat provisioning to verify no credential/work/state resets.

Server contract paths: server/tests/lab-03/*.test.ts. UI paths follow this repo's client/tests/lab-03 convention (the handout's client/... location is illustrative). E2E paths are client/e2e/lab-03/*.spec.ts, matching current Playwright testDir. Include api-spec exact statuses/projections in assertions, not just button snapshots.

## 2. Planned test cases

| Test ID | Type | ACs | Behavior and expected result | Planned test file | Final status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-03 | Password bounds15/128, Unicode/spaces, whitespace-only,512-byte bound, exact confirmation and no truncation/trim | server/tests/lab-03/password.test.ts | Passed locally (3 tests) and in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| UNIT-02 | Unit | AC-03 | scrypt encoding/parameters/salts, valid/invalid verification and constant-time-compatible comparisons; no plaintext storage | server/tests/lab-03/password.test.ts | Passed locally (3 tests) and in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| PERF-01 | Performance gate | AC-03 | Before auth coding, benchmark proposed scrypt profile on intended local and CI runtimes: 10 serial hashes and two concurrent hashes; record p95 latency and additional peak RSS against BR-09 gate, then freeze or review a contract revision | server/scripts/lab3/password-benchmark.ts plus docs/lab-03/tests.md (benchmark result) | Passed locally on Node 24.14.0 (p95 327.72 ms; +256.04 MiB RSS) and in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| UNIT-03 | Unit | AC-17 | Parameterized full8x8 transition matrix: every allowed edge and every denied edge, including same-state | server/tests/lab-03/workflow.test.ts | Planned / Not run |
| UNIT-04 | Unit | AC-12 | Query normalization/defaults, priority rank, tie-breakers, duplicate/unknown/out-of-range/safe-offset parameters | server/tests/lab-03/queue-query.test.ts | Planned / Not run |
| UNIT-05 | Unit | AC-31 | Test-target guard rejects missing/malformed/non-test/same targets despite credential/query-order changes; safe messages | server/tests/lab-03/test-database.test.ts | Passed locally (5 tests); Server CI run [35220666570](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35220666570) |
| UNIT-06 | Unit | AC-19, AC-20, AC-21 | Content trim/1-5000 bounds and projection separation; script-like text is data | server/tests/lab-03/conversations.test.ts | Planned / Not run |
| API-01 | API | AC-01 | Active valid login yields safe AuthResponse/cookie; malformed input400 and unavailable/wrong/inactive/unprovisioned401 uniform | server/tests/lab-03/auth.api.test.ts | Passed covered cases locally and in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| API-02 | API | AC-02 | Restricted session allows only me/change/logout; issued t0 is valid at t0+15m-epsilon, activity at t0+14m59s changes neither lastSeenAt nor expiresAt, and me/change return401 at exactly/after t0+15m while logout204 | server/tests/lab-03/auth.api.test.ts, server/tests/lab-03/auth.review-regression.api.test.ts | Passed fixed-expiry/lastSeen cases previously; normal Ticket/Attachment/reference APIs now assert 403 PASSWORD_CHANGE_REQUIRED in Server CI run [35248063736](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35248063736) |
| API-03 | API/PostgreSQL | AC-03 | Wrong current password401 and invalid new/confirmation/same400; fault injection at User update/session delete/replacement insert proves full rollback; success atomically commits password+revocation+one normal session before cookie, and simulated lost response recovers by new-password login | server/tests/lab-03/auth.api.test.ts, server/tests/lab-03/auth.postgres.integration.test.ts, server/tests/lab-03/auth.rollback.postgres.integration.test.ts | Passed real PostgreSQL User-update/session-delete/replacement-insert rollback fault injection and simulated post-commit response-loss recovery in Server CI run [35248063736](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35248063736) |
| API-04 | API | AC-04 | me returns actual role/flag; missing/expired/idle/revoked/inactive sessions401; store failure safe500/no access | server/tests/lab-03/auth.api.test.ts | Passed covered session cases in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| API-05 | API | AC-05 | Valid logout204 clears/deletes token; old token protected replay401; repeated/absent/expired logout204; valid-session CSRF failure403 leaves session intact; invalid Origin403 | server/tests/lab-03/auth.api.test.ts, server/tests/lab-03/auth.postgres.integration.test.ts | Passed covered logout/CSRF/idempotency cases in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| API-06 | API | AC-06 | Parameterize every protected endpoint/method against every role, including restricted/anonymous; matrix denial precedes resource lookup | server/tests/lab-03/authorization.api.test.ts | Issue #55 authorization/Requester-regression scope only. Reference data explicitly covers anonymous 401, restricted 403 and Requester/IT Staff/Administrator 200 without legacy-header identity. Covered Requester resource routes assert exact allowed/denied contracts. Internal Note GET/POST are authorization stubs here: only anonymous/restricted/Requester denial is claimed; Staff/Admin success remains Planned / Not run until the Comments/Notes implementation. CI evidence pending this revision. |
| API-07 | API | AC-06 | A cookie plus B requester header cannot impersonate B; requesterId body/query400; non-owner resource safe404/no bytes | server/tests/lab-03/authorization.api.test.ts | Passed spoofed header/body/query identity, owner isolation, and fail-closed legacy adapter runtime guard in Server CI run [35340891839](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35340891839) |
| API-08 | API | AC-20 | Requester Note GET/POST403 even for missing parents; no note content/author/count through detail/comments/errors | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| API-09 | API | AC-27 | Trusted/untrusted/missing Origin, exact credentialed CORS; JSON login only; CSRF on active-session JSON/multipart/logout writes, absent-session logout204 with trusted Origin | server/tests/lab-03/auth.api.test.ts | Passed covered Origin/CORS/CSRF/JSON cases in Server CI run [35236849889](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35236849889) |
| API-10 | API | AC-27 | Fifth failed pair/thirtieth IP failure allowed; next429/Retry-After; clock expiry/reset and process-restart bucket reset documented for bounded hashed in-memory throttle | server/tests/lab-03/auth.api.test.ts, server/tests/lab-03/auth.review-regression.api.test.ts | Passed pair limit plus 30-per-IP limit, 31st-request 429/Retry-After and fixed-window reset in Server CI run [35248063736](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35248063736) |
| API-11 | API | AC-27 | Cookie path/HttpOnly/SameSite/local Secure exception, HTTPS Secure, token rotation, absolute8h/idle30m expiry | server/tests/lab-03/auth.api.test.ts, server/tests/lab-03/auth.postgres.integration.test.ts, server/tests/lab-03/auth.review-regression.api.test.ts | Passed local-HTTP no-Secure and HTTPS Secure cookie assertions plus prior cookie/rotation/idle cases in Server CI run [35248063736](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35248063736) |
| API-12 | API | AC-09 | Cookie-owned create uses existing validation/number/date/NEW/request key; IT Priority copies request; client workflow fields400 | server/tests/lab-02/create-ticket.api.test.ts, server/tests/lab-02/create-ticket.postgres.integration.test.ts | Passed authenticated create/priority cases in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818) |
| API-13 | API/PostgreSQL | AC-09 | Sequential/concurrent create replay creates one Ticket; changed payload409; replay preserves later owner/status/priority | server/tests/lab-02/create-ticket.postgres.integration.test.ts | Passed authenticated replay/conflict cases in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818) |
| API-14 | API | AC-09 | Owned list/detail and AND filters/sort/pages retained; all8 statuses accepted; other Requester's data404/absent | server/tests/lab-02/my-tickets.api.test.ts, server/tests/lab-02/ticket-detail.postgres.integration.test.ts | Passed authenticated owner/detail cases in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818) |
| API-15 | API/PostgreSQL | AC-10 | Valid upload/file bytes/removal attribution; active limit/type/signature/size/invalid reason; removed/non-owner404; compensation | server/tests/lab-02/attachments.postgres.integration.test.ts | Passed authenticated lifecycle/concurrency cases in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818) |
| API-16 | API | AC-10, AC-14 | Staff reads/downloads any active Attachment; upload/remove403; wrong parent/removed404, storage paths absent | server/tests/lab-03/authorization.api.test.ts, server/tests/lab-02/attachments.postgres.integration.test.ts | Passed Staff read and Requester write-denial cases in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818) |
| API-17 | API | AC-11 | Development Requester endpoint404; headers supply no identity; runtime client helper/key removed | server/tests/lab-03/authorization.api.test.ts | Passed endpoint retirement/default runtime denial in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818); legacy E2E adapter is CI-only until UI issues remove the old client helper |
| API-18 | API/PostgreSQL | AC-12 | Shared queue search/each combined filter, mine/unassigned/specific owner, sort priority/ties and accurate pagination | server/tests/lab-03/staff-queue.api.test.ts | Planned / Not run |
| API-19 | API | AC-12 | Unknown/repeated/invalid query400, empty/beyond-end page200 accurate metadata, no Requester access | server/tests/lab-03/staff-queue.api.test.ts | Planned / Not run |
| API-20 | API | AC-14 | Detail exact DTO/read-only submitted values/owner/indication/resolution/file continuity; missing404; wrong role403 | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-21 | API/PostgreSQL | AC-15 | Claim self, already-self no-op, other owner409, eligible assign/reassign with ASSIGNED/REASSIGNED provenance; null/manual-unassign400, invalid/inactive target400 and terminal staff mutation409 | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-22 | API/PostgreSQL | AC-15, AC-16, AC-17, AC-18 | Competing owner/priority/status/indication writes: one version wins; losers409/no partial mutation; no-op rules | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-23 | API | AC-16 | IT Priority changes independently; invalid enum400; unchanged no-op; Requester403; terminal/stale409 | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-24 | API/PostgreSQL | AC-17 | Allowed transitions/input bounds; resolution/close timestamps; reopen resets public resolution/indication; reasons safe/public | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-25 | API | AC-17 | Every forbidden/same-state transition409, irrelevant fields400; requester transition403; no Actions Taken dependency | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned / Not run |
| API-26 | API/PostgreSQL | AC-18 | Owner indication eligible states, backend author/time, current-version no-op; status unchanged; non-owner404/ineligible409 | server/tests/lab-03/authorization.api.test.ts, server/tests/lab-02/ticket-detail.postgres.integration.test.ts | Passed owner/version/status cases in Server CI run [35324254818](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35324254818) |
| API-27 | API/PostgreSQL | AC-19 | Public content bounds, exact author/time, chronological order and empty list; one valid POST creates one entry201, unsupported clientRequestId400 | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| API-28 | API/PostgreSQL | AC-20 | Staff/Admin private append/read on terminal Tickets; edit/delete405; no cross-parent leak or Requester note projection | server/tests/lab-03/comments-notes.api.test.ts | Planned / Not run |
| API-29 | API | AC-22 | Admin list fields/name-email OR search/role AND filter/default order/empty; non-admin403; unknown params400 | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-30 | API/PostgreSQL | AC-23 | Admin create/edit one role/name/email/Boolean; duplicate normalized/inactive email409 and concurrent duplicates; stale edit409 | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-31 | API/PostgreSQL | AC-15, AC-24 | Deactivate/demote/account edit revokes sessions and unassigns active and CLOSED/CANCELLED owners in one transaction; provenance former owner/actor/time persists; status/resolution/Requester/authorship/removal links unchanged | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-32 | API/PostgreSQL | AC-25 | Self-deactivation409; last active admin demotion/deactivation409; simultaneous changes cannot eliminate admins | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-33 | API/PostgreSQL | AC-26 | Reset validates/salts/hash/flag/revocation/version; no response password; self reset returns reauthenticationRequired | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| API-34 | API | AC-28 | Invalid JSON/bounded payloads and injected DB/file/service failures use exact safe errors/correlationId; no sensitive fragments | server/tests/lab-03/auth.api.test.ts, server/tests/lab-03/auth.review-regression.api.test.ts | Passed malformed JSON/safe-error coverage plus exact 16 KiB accepted-for-validation and 16 KiB+1 rejected size boundary in Server CI run [35248063736](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35248063736); remaining non-auth service-failure cases planned |
| DB-01 | Migration | AC-07 | Isolated historical schema -> forward migration: IDs/counts/activation/FKs/numbering/removal fields and sample file hashes preserved | server/tests/lab-03/migration.postgres.integration.test.ts | Passed in isolated Server CI run [35220666570](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35220666570) |
| DB-02 | Seed/provisioning | AC-08 | NULL-hash users provision once; repeats skip changed credentials/inactive states; seed twice minima24 Tickets/all8 statuses/all4 priorities | server/tests/lab-03/seed-provisioning.postgres.integration.test.ts | Passed in isolated Server CI run [35220666570](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35220666570); Vitest workers serialized |
| DB-03 | Regression | AC-07, AC-09, AC-24 | Migration sequence continues; historical create replay/attachment links survive and author/requester role change does not delete links | server/tests/lab-03/migration.postgres.integration.test.ts | Passed in isolated Server CI run [35220666570](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35220666570) |
| DB-04 | Concurrency | AC-15, AC-24, AC-25 | Owner assignment racing with account demotion cannot persist an ineligible owner; terminal owner cleanup retains TicketOwnerChange under concurrency; last-admin safety uses real transactions | server/tests/lab-03/users-admin.api.test.ts | Planned / Not run |
| UI-01 | UI | AC-01, AC-28 | Login labels/policy validation/busy/generic failure/inactive/rate-limit/network retry; password cleared safely | client/tests/lab-03/Login.test.tsx | Partially passed locally 2026-09-18 (3 tests): field/focus validation, busy success/mandatory routing and generic 401/password clearing passed. Explicit 429 and network-retry assertions remain Planned / Not run. |
| UI-02 | UI | AC-02, AC-03 | Mandatory/voluntary password modes, fixed initial-session deadline/no activity extension, no skip, validation, atomic-save success, pre-commit retry, ambiguous post-commit login recovery and secret clearing | client/tests/lab-03/ChangePassword.test.tsx | Partially passed locally 2026-09-18 (5 tests): mandatory restriction/deadline copy, policy/confirmation, rejected-current-password recovery, committed success and ambiguous-network login recovery passed. Exact client clock-boundary and injected 500 pre-commit retry assertions remain Planned / Not run; expiry remains server-authoritative. |
| UI-03 | UI | AC-04, AC-05, AC-06, AC-11 | Role navigation/guards/bootstrap-no-flash; legacy key clear; logout and stale cross-account requests cannot render old data | client/tests/lab-03/AuthenticatedShell.test.tsx | Partially passed locally 2026-09-18 (5 shell tests plus 3 bootstrap tests in client/tests/lab-01/App.test.tsx): no-flash bootstrap, role placeholders/navigation, direct-route guard, legacy-key removal, failed/successful logout and revoked-session clearing passed. A deliberately delayed stale cross-account response case remains Planned / Not run. |
| UI-04 | UI/regression | AC-09, AC-10, AC-11 | Adapt Lab 2 Create/My Tickets/Detail/Attachment tests to session; validation/idempotency/files/partial retries preserved | client/tests/lab-03/RequesterRegression.test.tsx | Passed locally 2026-09-18: authenticated API client regression (2 tests) plus adapted Create/My Tickets/Detail/Attachment suites (35 tests) passed; all requests assert/use cookie credentials, writes use in-memory CSRF, CURRENT_PASSWORD_INVALID does not clear a valid session, and no runtime requester header/query/body identity remains. |
| UI-05 | UI | AC-12, AC-13 | Queue controls reset page, badges/owner/open, empty/no-results/loading/forbidden/error and beyond-end recovery | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned / Not run |
| UI-06 | UI | AC-14, AC-15, AC-16, AC-17 | Detail read-only values vs operational controls; claim/assign/reassign but no manual-unassign action; confirmations/matrix fields/save busy/409 refresh and terminal rules | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned / Not run |
| UI-07 | UI | AC-18, AC-19, AC-20, AC-21 | Requester indication/comment flow; public/private independent drafts/buttons; inert scripts; ambiguous-post list reload and review-before-manual-retry; no requester notes | client/tests/lab-03/CommentsNotes.test.tsx | Issue #56 portion partially passed locally 2026-09-18: Requester indication confirmation/API/version and unchanged formal status are covered in client/tests/lab-02/RequesterTicketDetail.test.tsx. Public Comments/Internal Notes belong to child Issue #61 and integrated Staff UI belongs to #75; both remain Planned / Not run. |
| UI-08 | UI | AC-22, AC-23, AC-25 | Admin list/create/edit/search/role/activation, duplicate/one-role/last-admin/self/stale errors and retry | client/tests/lab-03/UserManagement.test.tsx | Planned / Not run |
| UI-09 | UI | AC-24, AC-26, AC-28 | Reset/account edit confirmations, cleared passwords, self reauthentication and safe processing/failure feedback | client/tests/lab-03/UserManagement.test.tsx | Planned / Not run |
| STYLE-01 | UI style | AC-21, AC-29 | Shared Zen Green tokens/components, text-bearing badges, readonly/editable and Public/Private distinction | client/tests/lab-03/ZenGreenStyle.test.tsx | Partially passed locally 2026-09-18 through adapted client/tests/lab-02/ZenGreenStyle.test.tsx (4 tests); full Lab 3 role/Public-Private and responsive visual scope remains Planned / Not run. |
| A11Y-01 | UI accessibility | AC-30 | Labels/errors/live state and first-invalid focus; keyboard dialog trap/Escape/return focus, menus and sort semantics | client/tests/lab-03/accessibility.test.tsx | Partially passed locally 2026-09-18 through adapted client/tests/lab-02/accessibility.test.tsx (5 tests) and auth form assertions; full dialog/menu/sort and browser keyboard audit remains Planned / Not run. |
| E2E-01 | E2E | AC-01, AC-02, AC-03, AC-04, AC-05, AC-27 | Real valid/invalid/inactive login; mandatory-session fixed 15-minute boundary; atomic password rotation/new-login recovery; role landing/logout/replay denial and normal expiry | client/e2e/lab-03/authentication.spec.ts | Planned / Not run |
| E2E-02 | E2E/regression | AC-06, AC-09, AC-10, AC-11, AC-18, AC-19 | Requester A/B create/list/detail/files/comments/indication; identity spoof/direct non-owner denial | client/e2e/lab-03/requester-regression.spec.ts | Planned / Not run |
| E2E-03 | E2E | AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-20, AC-21 | Real queue -> claim/reassign/priority/status/public/private/file download; Requester cannot read private note | client/e2e/lab-03/staff-ticket-flow.spec.ts | Planned / Not run |
| E2E-04 | E2E | AC-22, AC-23, AC-24, AC-25, AC-26 | Admin search/create/edit/activate/reset/first-change and real revocation; self/last-admin/wrong-role restrictions | client/e2e/lab-03/user-administration.spec.ts | Planned / Not run |
| RESP-01 | Browser responsive | AC-29, AC-30 | Every major screen at1440/768/390/360 widths and200% zoom; actions/focus reachable, no page overflow/clipping/overlap | client/e2e/lab-03/responsive-visual.spec.ts | Planned / Not run |
| VIS-01 | Manual visual | AC-13, AC-21, AC-28, AC-29, AC-30 | Screenshot checklist, actual contrast/keyboard/zoom, failure/conflict states and password/private-data redaction verified by a human | docs/lab-03/tests.md (visual checklist/results) | Planned / Not run |
| RELEASE-01 | Release audit | AC-31, AC-32 | Cross-reference actual final-main result/output for every listed UNIT/PERF/API/DB/UI/STYLE/A11Y/E2E/RESP/VIS ID, preserved Lab1/2 regression, builds, migration/seed, zero required skips and Issue/PR/peer/AI/PDF evidence | docs/lab-03/tests.md (release results) | Planned / Not run |

Table contains 63 unique planned Test IDs. A row represents a case group; parameterized cases may produce a different automated assertion/test count. Final reports must use observed counts, not this row count.

### Issue #56 local execution record — 2026-09-18

Consolidated Issue #56 implemented the client authentication/session shell and authenticated Requester regression scope only. `client/tests/lab-02/DevelopmentRequesterSelect.test.tsx` and `client/tests/lab-02/requester-api.test.ts` were retired because their selector/header contracts are forbidden by AC-11; their substantive replacement coverage is in `client/tests/lab-01/App.test.tsx`, `client/tests/lab-03/AuthenticatedShell.test.tsx` and `client/tests/lab-03/RequesterRegression.test.tsx`. Ticket, query, validation, idempotency, Attachment and accessibility/style suites were adapted rather than deleted.

| Command | Observed result |
| --- | --- |
| `npm --prefix client test` | Passed: 11 test files, 62 tests; 0 failed/skipped. |
| `npm --prefix client run build` | Passed: TypeScript and Vite production build. |
| `npm --prefix server test` | Passed runnable suites: 12 files / 82 tests. Skipped: 8 PostgreSQL integration files / 14 tests because this local run did not set the required isolated `TEST_DATABASE_URL` and `RUN_DB_INTEGRATION=1`; those skips are not claimed as passes. |
| `npm --prefix server run build` | Passed: TypeScript build. |
| Client E2E / responsive / manual visual checklist | Not run; remains pending. |

Public Comments/Internal Notes were not implemented or mocked in Issue #56. They remain child Issue #61 API scope with integrated Staff UI in #75; the UI truthfully marks Public Comments unavailable. Staff and Administrator destinations are role-guarded landing placeholders only; queue, operational detail and user management feature evidence remains pending its dedicated issues. Because required integration/E2E/visual rows remain skipped or not run, RELEASE-01 and the Product Definition of Done remain incomplete.

## 3. AC-to-test index

| Acceptance Criterion | Planned evidence IDs |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-02, UI-02, E2E-01 |
| AC-03 | UNIT-01, UNIT-02, PERF-01, API-03, UI-02, E2E-01 |
| AC-04 | API-04, UI-03, E2E-01 |
| AC-05 | API-05, UI-03, E2E-01 |
| AC-06 | API-06, API-07, UI-03, E2E-02 |
| AC-07 | DB-01, DB-03 |
| AC-08 | DB-02 |
| AC-09 | API-12, API-13, API-14, DB-03, UI-04, E2E-02 |
| AC-10 | API-15, API-16, UI-04, E2E-02 |
| AC-11 | API-17, UI-03, UI-04, E2E-02 |
| AC-12 | UNIT-04, API-18, API-19, UI-05, E2E-03 |
| AC-13 | UI-05, E2E-03, VIS-01 |
| AC-14 | API-16, API-20, UI-06, E2E-03 |
| AC-15 | API-21, API-22, API-31, DB-04, UI-06, E2E-03 |
| AC-16 | API-22, API-23, UI-06, E2E-03 |
| AC-17 | UNIT-03, API-22, API-24, API-25, UI-06, E2E-03 |
| AC-18 | API-22, API-26, UI-07, E2E-02 |
| AC-19 | UNIT-06, API-27, UI-07, E2E-02 |
| AC-20 | UNIT-06, API-08, API-28, UI-07, E2E-03 |
| AC-21 | UNIT-06, UI-07, STYLE-01, E2E-03, VIS-01 |
| AC-22 | API-29, UI-08, E2E-04 |
| AC-23 | API-30, UI-08, E2E-04 |
| AC-24 | API-31, DB-03, DB-04, UI-09, E2E-04 |
| AC-25 | API-32, DB-04, UI-08, E2E-04 |
| AC-26 | API-33, UI-09, E2E-04 |
| AC-27 | API-09, API-10, API-11, E2E-01 |
| AC-28 | API-34, UI-01, UI-09, VIS-01 |
| AC-29 | STYLE-01, RESP-01, VIS-01 |
| AC-30 | A11Y-01, RESP-01, VIS-01 |
| AC-31 | UNIT-05, RELEASE-01 |
| AC-32 | RELEASE-01 |

## 4. Lab 1/2 regression disposition

| Existing file/group | Lab 3 treatment |
| --- | --- |
| server/tests/lab-01/health.test.ts | Preserve health behavior. |
| server/tests/lab-01/categories.test.ts | Adapt authentication setup for now-protected categories; preserve active/category contract. |
| server/tests/lab-02/reference-data.api.test.ts | Preserve category/system cases under session; retire Development Requester listing cases explicitly. |
| server/tests/lab-02/create-ticket*, my-tickets*, ticket-detail*, attachments* | Adapt mocks/Prisma delegates/request context to User/session; preserve all relevant validation/idempotency/ownership/files/assertions. |
| server/tests/lab-02/seed-data.test.ts | Replace old overwriting seed expectations with creation-only credential/work/state preservation tests; preserve required reference fixtures. |
| client/tests/lab-01/App.test.tsx | Adapt obsolete connectivity-shell expectations to auth shell; retain health/API failure coverage at its appropriate layer. |
| client/tests/lab-02/DevelopmentRequesterSelect.test.tsx | Retire obsolete selector tests; replace with auth/legacy-key-removal cases. |
| client/tests/lab-02/requester-api.test.ts | Replace requesterId/header assertions with credentials/CSRF and preserved resource responses. |
| client/tests/lab-02/CreateTicket, MyTickets, RequesterTicketDetail, AttachmentSection, ZenGreenStyle, accessibility | Preserve functional/style/accessibility coverage with authenticated setup. |
| client/e2e/lab-02/requester-ticket-flow, responsive-visual, visual-evidence | Adapt setup to login/first-change and isolated fixture creation; preserve Ticket/file/responsive cases. |

Do not run unadapted obsolete selector tests and claim that expected failures prove a regression. Do not delete substantive Ticket/file cases to achieve a green count. Record moved/retired paths and reasons when implementing.

## 5. TDD and final execution record

For each feature: implement a meaningful failing test against the contract -> minimal passing implementation -> refactor -> run affected suites/build. Include observed red/green commands/results in its PR when practical. Real PostgreSQL concurrency/migration/security tests are required where mocks cannot prove guarantees. Manual review/PDF history is an audit, not an invented automated test.

Planned final commands after the isolation foundation exists (the environment variable contains only the private local test URL):

```powershell
$env:TEST_DATABASE_URL = "<isolated PostgreSQL test URL>"
$env:RUN_DB_INTEGRATION = "1"
# Foundation test setup validates the target before migrate/seed/Prisma creation.
npm --prefix server test
npm --prefix server run build
npm --prefix client test
npm --prefix client run build
npm --prefix client run e2e
git diff --check
```

A full verification wrapper/setup must fail if TEST_DATABASE_URL is absent/unsafe while integration is requested. Do not use the old Playwright fallback or substitute production/development URLs. Exact setup commands and actual output paths will be documented in the foundation PR; no nonexistent verification script is claimed here.

Final results must record verified main commit/tree, date, runtime/PostgreSQL/browser versions, commands/exit statuses, automated suite/test counts including skips, test target identity without credentials, full safe outputs under artifacts/lab-03/test-results/, actual file paths and each row's observed status. Required skipped/failing cases keep Product DoD incomplete. If runtime source changes after verification, rerun affected checks and update revision evidence.

### RELEASE-01 evidence specificity for AC-31

The release audit is a cross-reference, not a substitute for feature tests. It must list the actual final-main result and safe output path for **UNIT-01-06, PERF-01, API-01-34, DB-01-04, UI-01-09, STYLE-01, A11Y-01, E2E-01-04, RESP-01 and VIS-01**. For each ID, record pass/fail/not-run/skip and the implemented test file or manual record; preserve planned-to-actual path changes. It must also list the adapted Lab 1/2 regression suites, server/client builds, migration and twice-run seed evidence, direct authorization checks and the final main revision. AC-31 passes only if all required rows and regression suites have observed passing evidence with zero required skips and matching revision; a passing UNIT-05 guard alone is insufficient. PERF-01 is a pre-auth benchmark gate and its outcome must be attached before Issue #54 coding, then referenced again from the final audit.

Visual checklist is [ui-spec.md section11](ui-spec.md#11-visual-evidence-and-checklist); record actual screenshots/reviewer/date/observations here at that stage. All visual/release checks and Product DoD remain pending.
