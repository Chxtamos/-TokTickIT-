# Lab 4 Test Plan and Traceability

Status: planned before implementation for Issue #91. `Final` remains **Planned** until an actual test executes on the relevant revision; no planned test is represented as passing evidence.

| ID | Type | AC | What it tests | Expected result | Intended automated file | Final |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-05 | Action validation/follow-up/result boundaries | Contract rules accepted/rejected exactly | `server/tests/lab-04/action-validation.test.ts` | Planned |
| UNIT-02 | Unit | AC-05, AC-07 | Action transition and stable-order helpers | Only allowed transitions; deterministic order | `server/tests/lab-04/action-workflow.test.ts` | Planned |
| API-01 | API | AC-03 | Requester reads owned Actions/non-owned protection | Owned 200; non-owned safe 404 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | AC-03 | Requester/direct wrong-role writes | 403 and no mutation | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | AC-01 | Valid Action create | Correct Ticket, backend actor/time, 201 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | API | AC-02 | Repeated create/idempotency conflict | One row; same replay safe; changed payload 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | AC-04 | Active/inactive/wrong-role assignee | Only active operational assignee accepted | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | AC-05 | Action edit/status/complete/cancel | Validation and lifecycle enforced | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | AC-06 | Stale Action expectedVersion | 409; newer row preserved | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-08 | API | AC-07 | Immutable actor/time + list ordering | Immutable fields rejected; stable order | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-09 | API | AC-08, AC-09 | Ticket final transition matrix/resolution gate | Only permitted transitions; incomplete Actions block resolution | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-10 | API | AC-10 | Requester dashboard ownership/calculations | Only self data; accurate zero/non-zero values | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-11 | API | AC-11, AC-12 | Staff/Admin dashboard calculations | Accurate authoritative metrics/concise lists | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| DB-01 | PostgreSQL | AC-13 | Forward migration on Lab 3-shaped data | Earlier rows preserved; Action schema valid | `server/tests/lab-04/migration.postgres.integration.test.ts` | Planned |
| DB-02 | PostgreSQL | AC-13 | Seed twice | No duplicates/destructive overwrite | `server/tests/lab-04/seed.postgres.integration.test.ts` | Planned |
| DB-03 | PostgreSQL | AC-02, AC-06 | Concurrent create/update constraints | Idempotency/version guarantees hold atomically | `server/tests/lab-04/actions.postgres.integration.test.ts` | Planned |
| DB-04 | PostgreSQL | AC-11 | Selected dashboard query truth | API counts match direct representative queries | `server/tests/lab-04/dashboard.postgres.integration.test.ts` | Planned |
| UI-01 | UI | AC-10, AC-15 | Requester Dashboard modes/drill-down | Correct owned summary and feedback | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-02 | UI | AC-11, AC-12, AC-15 | Staff Dashboard modes/drill-down | Metrics/lists/links/feedback render correctly | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-03 | UI | AC-01, AC-03, AC-04, AC-05, AC-06, AC-15 | Actions list/create/edit/read-only/conflicts | Role controls and recoverable forms correct | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-04 | UI | AC-08, AC-09, AC-15 | Ticket workflow controls/feedback | Only permitted choices; refresh after success | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| REG-01 | Regression | AC-14 | Server Labs 1-3 representative suites | No approved API/auth/ownership regression | existing `server/tests/lab-01..03` | Planned |
| REG-02 | Regression | AC-14 | Client Labs 1-3 representative suites | No approved UI regression | existing `client/tests/lab-01..03` | Planned |
| AUTH-01 | Security | AC-03, AC-12, AC-14 | Role/ownership/CSRF/safe errors | Backend denies bypass attempts without leaks | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| RESP-01 | Responsive | AC-16 | 1440/768/390/360/200%-equivalent layouts | No document horizontal overflow/clipping | `client/e2e/lab-04/responsive.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-16 | keyboard/focus/labels/non-color cues | Required checklist/assertions pass | `client/tests/lab-04/accessibility.test.tsx` + manual record | Planned |
| PERF-01 | Performance smoke | AC-11, AC-17 | Dashboard/Action representative dataset smoke | No unbounded collection DTO; acceptable local/CI smoke timing recorded | `server/tests/lab-04/performance-smoke.test.ts` | Planned |
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

## TDD and execution policy

For each implementation Issue: add/activate a meaningful failing test against this approved contract, implement the minimum behavior, refactor, then run affected suites/builds. PostgreSQL migration/concurrency/idempotency/dashboard-truth guarantees require real isolated PostgreSQL coverage where mocks cannot prove them. A skipped required integration test is not a pass.

Final evidence must record revision, commands, exit statuses, suite/test counts including skips, actual test paths and safe output locations. Human visual/accessibility review remains explicitly human evidence; automated screenshots are supporting evidence only.
