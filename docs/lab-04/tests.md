# Lab 4 Test Plan and Traceability

Status: planned before implementation for Issue #91. `Final` remains **Planned** until an actual test executes on the relevant revision; no planned test is represented as passing evidence.

| ID | Type | AC | What it tests | Expected result | Intended automated file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-05 | Action validation/follow-up/result boundaries | Contract rules accepted/rejected exactly | `server/tests/lab-04/action-validation.test.ts` | Planned |
| UNIT-02 | Unit | AC-05, AC-07 | Action transition and stable-order helpers | Only allowed transitions; deterministic order | `server/tests/lab-04/action-workflow.test.ts` | Planned |
| API-01 | API | AC-03 | Requester reads owned Actions/non-owned protection | Owned 200; non-owned safe 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-02 | API | AC-03 | Requester/direct wrong-role writes | 403 and no mutation | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-03 | API | AC-01 | Valid Action create | Correct Ticket, backend actor/time, 201 | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-04 | API | AC-02 | Repeated create/idempotency conflict + non-enumeration | One row; same replay safe; changed authorized payload 409; inaccessible Ticket reveals nothing | `server/tests/lab-04/actions-taken.api.test.ts` | Passed after PR #102 non-enumeration feedback revision |
| API-05 | API | AC-04 | Active/inactive/wrong-role assignee | Only active operational assignee accepted | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-06 | API | AC-05 | Action edit/status/complete/cancel | Validation and lifecycle enforced | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-07 | API | AC-06 | Stale Action expectedVersion | 409; newer row preserved | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-08 | API | AC-07, AC-21 | Immutable creator/time + audit actors + list ordering | Immutable fields rejected; stable order; each successful mutation creates actor/version event | `server/tests/lab-04/actions-taken.api.test.ts` | Passed on Issue #93 GREEN verification |
| API-09 | API | AC-08, AC-09, AC-19 | Ticket final transition matrix/current-cycle resolution gate | CANCELLED-only/old-cycle/incomplete Actions block; valid current-cycle completion permits resolution | `server/tests/lab-04/ticket-workflow.api.test.ts` | Passed on Issue #95 GREEN verification |
| API-10 | API | AC-10 | Requester dashboard ownership/calculations | Only self data; accurate zero/non-zero values | `server/tests/lab-04/requester-dashboard.api.test.ts` | Passed on Issue #97 GREEN verification |
| API-11 | API | AC-11, AC-12 | Staff/Admin dashboard calculations | Accurate authoritative metrics/concise lists | `server/tests/lab-04/staff-dashboard.api.test.ts` | Passed after PR #105 ordering/drill-down feedback revision |
| DB-01 | PostgreSQL | AC-13, AC-22 | Forward migration/backfill on Lab 3-shaped data | Earlier rows preserved; Tickets default cycle 1; Action/audit schema valid | `server/tests/lab-04/migration.postgres.integration.test.ts` | Passed on PR #101 feedback revision |
| DB-02 | PostgreSQL | AC-13 | Seed twice | No duplicates/destructive overwrite | `server/tests/lab-04/seed.postgres.integration.test.ts` | Passed on PR #101 feedback revision |
| DB-03 | PostgreSQL | AC-02, AC-06, AC-20 | Concurrent create/update/resolve constraints | Identical creates converge; stale edits lose safely; parent lock serializes Action-vs-resolve race | `server/tests/lab-04/actions.postgres.integration.test.ts` | Planned |
| DB-04 | PostgreSQL | AC-11 | Selected dashboard query truth | API counts match direct representative queries | `server/tests/lab-04/dashboard.postgres.integration.test.ts` | Passed through real-PostgreSQL assertions in `staff-dashboard.api.test.ts` on Issue #96 |
| DB-05 | PostgreSQL | AC-19, AC-20 | Close -> reopen -> new-cycle resolution race | Reopen increments cycle atomically; prior-cycle completion cannot satisfy new resolution; concurrent child mutation cannot slip past gate | `server/tests/lab-04/workflow-cycle.postgres.integration.test.ts` | Planned |
| DB-06 | PostgreSQL | AC-07, AC-21 | Action mutation audit atomicity | Action and matching event commit/rollback together with correct actor/resultingVersion | `server/tests/lab-04/action-audit.postgres.integration.test.ts` | Planned |
| UI-01 | UI | AC-10, AC-15 | Requester Dashboard modes/drill-down | Correct owned summary and feedback | `client/tests/lab-04/RequesterDashboard.test.tsx` | Passed on Issue #97 GREEN verification |
| UI-02 | UI | AC-11, AC-12, AC-15 | Staff Dashboard modes/drill-down | Metrics/lists/links/feedback render correctly | `client/tests/lab-04/StaffDashboard.test.tsx` | Passed after PR #105 exact-open-work drill-down feedback revision |
| UI-03 | UI | AC-01, AC-03, AC-04, AC-05, AC-06, AC-15 | Actions list/create/edit/read-only/conflicts | Role controls and recoverable forms correct | `client/tests/lab-04/ActionsTaken.test.tsx` | Passed after PR #103 stale-response feedback revision |
| UI-04 | UI | AC-08, AC-09, AC-15 | Ticket workflow controls/feedback | Only permitted choices; refresh after success | `client/tests/lab-04/TicketWorkflow.test.tsx` | Passed on Issue #95 GREEN verification |
| REG-01 | Regression | AC-14 | Server Labs 1-3 representative suites | No approved API/auth/ownership regression | existing `server/tests/lab-01..03` | Passed on Issue #98 full server run: 242/242 |
| REG-02 | Regression | AC-14 | Client Labs 1-3 representative suites | No approved UI regression | existing `client/tests/lab-01..03` | Passed on Issue #98 full client run: 122/122 |
| AUTH-01 | Security | AC-02, AC-03, AC-12, AC-14 | Role/ownership/idempotency disclosure/CSRF/safe errors | Backend denies bypass attempts without leaks, including idempotency existence oracle | `server/tests/lab-04/authorization.api.test.ts` | Passed on Issue #98: 3/3 focused hardening checks plus existing role/idempotency coverage |
| RESP-01 | Responsive | AC-16 | 1440/768/390/360/200%-equivalent layouts | No document horizontal overflow/clipping | `client/e2e/lab-04/responsive.spec.ts` | Automated viewport/keyboard run passed 3/3 on Issue #98; Human visual sign-off pending |
| A11Y-01 | Accessibility | AC-16 | keyboard/focus/labels/non-color cues | Required checklist/assertions pass | `client/tests/lab-04/accessibility.test.tsx` + manual record | Automated UI 2/2 + Playwright keyboard focus passed; Human accessibility sign-off pending |
| PERF-01 | Performance smoke | AC-11, AC-17 | Dashboard/Action representative dataset smoke | No unbounded collection DTO; acceptable local/CI smoke timing recorded | `server/tests/lab-04/performance-smoke.test.ts` | Passed on Issue #98: bounded DTO assertions and <3s local smoke |
| E2E-01 | E2E | AC-01..08 | Action create/assign/edit/complete/cancel/read-only flow | End-to-end role/action behavior succeeds | `client/e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-08, AC-09 | Ticket resolution lifecycle | Resolution gate and final lifecycle succeed | `client/e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-10..12 | Role dashboards/drill-down | Accurate dashboard journeys | `client/e2e/lab-04/dashboards.spec.ts` | Planned |
| RELEASE-01 | Release | AC-13..18 | Full reviewed staging/final-main audit | Required tests/builds/evidence green on recorded revision | release evidence record | Planned |

## AC traceability

| AC | Planned tests |
| --- | --- |
| AC-01 | API-03, UI-03, E2E-01 |
| AC-02 | API-04, DB-03, E2E-01 |
| AC-03 | API-01, API-02, AUTH-01, UI-03, E2E-01 |
| AC-04 | API-05, UI-03, E2E-01 |
| AC-05 | UNIT-01, UNIT-02, API-06, UI-03, E2E-01 |
| AC-06 | API-07, DB-03, UI-03, E2E-01 |
| AC-07 | UNIT-02, API-08, E2E-01 |
| AC-08 | API-09, UI-04, E2E-02 |
| AC-09 | API-09, UI-04, E2E-02 |
| AC-10 | API-10, UI-01, E2E-03 |
| AC-11 | API-11, DB-04, UI-02, PERF-01, E2E-03 |
| AC-12 | API-11, AUTH-01, UI-02, E2E-03 |
| AC-13 | DB-01, DB-02, RELEASE-01 |
| AC-14 | REG-01, REG-02, AUTH-01, RELEASE-01 |
| AC-15 | UI-01, UI-02, UI-03, UI-04, E2E-01, E2E-03 |
| AC-16 | RESP-01, A11Y-01, RELEASE-01 |
| AC-17 | PERF-01, E2E-01, E2E-02, E2E-03, RELEASE-01 |
| AC-18 | RELEASE-01 |
| AC-19 | API-09, DB-05, E2E-02 |
| AC-20 | DB-03, DB-05, E2E-02 |
| AC-21 | API-08, DB-06, E2E-01 |
| AC-22 | DB-01, RELEASE-01 |

## TDD and execution policy

For each implementation Issue: add/activate a meaningful failing test against this approved contract, implement the minimum behavior, refactor, then run affected suites/builds. PostgreSQL migration/concurrency/idempotency/dashboard-truth guarantees require real isolated PostgreSQL coverage where mocks cannot prove them. A skipped required integration test is not a pass.

Final evidence must record revision, commands, exit statuses, suite/test counts including skips, actual test paths and safe output locations. Human visual/accessibility review remains explicitly human evidence; automated screenshots are supporting evidence only.

Issue #92 note: the first feature commit combined tests and implementation, so repository history does not provide a separate RED commit for this Issue. Final TDD evidence must state this limitation truthfully and must not claim a preserved RED -> GREEN commit sequence for #92.

Issue #93 TDD evidence: commit `cfc1514` contains the Actions Taken API tests before implementation. Executing `server/tests/lab-04/actions-taken.api.test.ts` on that exact commit produced 7/7 failures because the contracted routes did not yet exist (404 responses). The following implementation commit is the GREEN step and must be verified on its exact revision before the Issue is considered review-ready.

Issue #94 TDD evidence: commit `f2b579e` contains `client/tests/lab-04/ActionsTaken.test.tsx` before the Actions Taken client component/API contract existed. On that exact RED revision, the client build failed on the missing `ActionsTaken` module, `ActionTaken` DTO and planned Action API functions. The GREEN implementation passed the original focused UI suite (7/7), Requester/Staff Ticket Detail regression (16/16), full client unit/UI suite (100/100) and production build. PR #103 review then identified a cross-ticket stale-response race; the feedback revision adds deterministic deferred-promise coverage proving stale success/error responses cannot overwrite the current Ticket. After that revision the focused UI suite passes 9/9, Ticket Detail regression passes 16/16, and the full client suite passes 102/102. Focused Playwright evidence in `client/e2e/lab-04/actions-taken-ui.spec.ts` passes 2/2 for the Staff create/edit -> Requester read-only and responsive no-overflow journey. Automated evidence does not replace final Human visual/accessibility sign-off.

Issue #95 TDD evidence: RED commit `14fdfeb` defines the final Ticket workflow API/UI behavior before implementation. On that exact RED revision, the PostgreSQL API suite had 3 failures / 3 passes: resolution incorrectly succeeded with zero/current-cycle-incomplete or old-cycle-only evidence, and REOPENED did not increment `workflowCycle`. The UI suite had 2 failures / 8 passes: resolution-gate guidance and specific recoverable `RESOLUTION_ACTIONS_INCOMPLETE` feedback were missing. The GREEN implementation enforces the current-cycle gate under the existing parent Ticket lock, increments `workflowCycle` atomically on REOPENED, preserves Requester indication as advisory, and provides recoverable UI guidance. Focused GREEN verification passes API 6/6 and UI 10/10; full Lab 4 server passes 15/15 and full client passes 112/112. Lab 3 workflow regression fixtures were updated to include valid Lab 4 completion evidence without weakening the new gate.

Issue #96 TDD evidence: RED commit `c157e54f7790bb663ca4d1fb534a37f2900e6fb1` defines the Staff Dashboard API/UI before implementation. On that exact RED revision, the API suite failed 2/2 because `/api/staff/dashboard` returned 404 and the UI suite failed 3/3 because `getStaffDashboard` and Dashboard routing did not exist. GREEN commit `b6dbb6e91ad48386287763913772da504aeff1ed` adds backend-authoritative PostgreSQL counts/distributions, bounded Ticket/Action lists, IT Staff/Administrator access, Queue/Detail drill-downs, loading/error/empty states and responsive Zen Green Dashboard UI. PR #105 review later found that only URGENT should outrank recency and that `My Open Actions` needed a drill-down to the same assigned PENDING/IN_PROGRESS work counted by the metric. The feedback revision adds explicit PostgreSQL ordering/take-10 assertions with interleaved non-URGENT priorities and a regression where newer completed history pushes an open assigned Action out of `myRecentActions` while it remains visible in `myOpenActionItems`. After revision, Staff Dashboard API passes 2/2, full Lab 4 server 17/17, Staff Dashboard UI 4/4, full client 116/116, and both builds pass.

Issue #97 TDD evidence: RED commit `9b69dca8ecaeac2594cd73a0c8a35f07f864aa09` defines the Requester Dashboard API/UI before implementation. On that exact RED revision, the API suite failed 2/2 because `/api/requester/dashboard` returned 404 and the UI suite failed 4/4 because the Requester Dashboard client contract/route did not exist. The GREEN implementation adds backend-authoritative requester-owned `openTickets`/`waitingForRequester` metrics, bounded `recentlyUpdated`/`recentlyResolved` lists, role/query-parameter protection, Dashboard navigation, recent-item detail drill-downs and My Tickets filters including additive `state=open` support for the contracted open-Ticket drill-down. Pre-commit verification passes Requester Dashboard API 2/2, full Lab 4 server 19/19, Lab 2 My Tickets API regression 6/6, Requester Dashboard UI 4/4, Change Password regression 6/6, full client 120/120, and both builds.

Issue #98 hardening evidence: RED commit `be7f6d9` introduced the final responsive/keyboard checks while the previously approved Lab 4 E2E journey still expected Staff login to land on Ticket Queue. Running the existing `actions-taken-ui.spec.ts` on that state failed 2/2 because #96 had legitimately changed Staff landing to IT Staff Dashboard; the initial new responsive run also exposed that E2E provisioning/CORS depended on shell-only `NODE_ENV`/`CLIENT_ORIGIN`. The hardening revision makes the fixture helper explicitly test-only, gives Playwright a deterministic allowed client origin, updates the Staff E2E journey to Dashboard -> Ticket Queue, adds required Dashboard viewport/keyboard checks, adds focused authorization/accessibility/performance smoke coverage, and fixes a pre-existing PostgreSQL test-isolation leak where the Administrator safety suite left seeded Administrators inactive. Verification after the fixes: focused authorization 3/3, performance smoke 1/1, automated accessibility 2/2, Lab 4 Actions/Responsive Playwright 5/5, full client 122/122, full server 242/242, and both builds passed. Human visual/accessibility sign-off and final release evidence remain pending.

PR #107 requested-change follow-up: GitHub Actions CI is added so verification runs on the actual PR head rather than relying on local evidence from an earlier commit. The CI provisions a distinct PostgreSQL database, deploys migrations/seeds, runs the full server and client suites, both builds, and focused Lab 4 Actions/Responsive Playwright. The Administrator cleanup regression fix is fail-loud: restoration runs in a transaction and the restored `id/isActive/version` snapshot is asserted before teardown completes. Human visual/accessibility sign-off remains a separate real-person gate.
