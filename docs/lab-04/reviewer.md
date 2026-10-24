# Lab 4 Reviewer Record

This file is intentionally evidence-only. Do not fabricate reviewer identity, approval, comments or dates.

## Issue #91 Engineering Contract

- Branch: `feature/41-lab4-engineering-contract`
- Target: `lab4-staging`
- Pull Request: #100 `Feature 41: Define Lab 4 engineering contract and test plan`
- Reviewer: `Tanaboonnnnn` requested changes on exact head `ff583f3622c7260a98f93a1836607a68667dbcdb` and later approved the revised contract on 2026-10-23.
- Review status: approved and merged into `lab4-staging` as merge commit `9c52410bdc931a2c205e3120f709ff9cfb5f28d5`.
- Comments/responses: reviewer identified five contract blockers: positive-completion resolution evidence, reopen workflow-cycle boundary, parent/child concurrency serialization, authorization-before-idempotency disclosure/concurrent replay semantics, and mutation actor auditability. Commit `2871f4992eba9ab8d88ac3d914e8c36e206ad6fb` addressed those points before the real approval and merge.

Later entries must link the real PR/review and summarize actual requested changes and responses.

## Issue #92 Actions Taken Data Foundation

- Branch: `feature/42-lab4-actions-data`
- Target: `lab4-staging`
- Pull Request: #101 `Feature 42: Implement Actions Taken data model, migration and seed`
- Reviewer: `chaproi` reviewed exact head `fa87f704694cd645756fdedd53f44f687916cdef`.
- Review status: changes requested on 2026-10-23; re-review pending after feedback commit.
- Comments/responses: reviewer requested real pre-Lab-4 migration/backfill proof, lifecycle-realistic seed audit history, full-seed non-destructive evidence, and correction of the PR #100 reviewer record. The follow-up revision addresses these blockers; approval is not claimed until a real re-review occurs.
- Verification: Prisma validate/build passed; focused PostgreSQL Lab 4 migration and seed tests passed; representative Lab 3 Staff workflow and Lab 2 Attachment PostgreSQL regression tests passed on an isolated `toktickit_lab4_test` database.

## Issue #93 Actions Taken APIs and Authorization

- Branch: `feature/43-lab4-actions-api`
- Target: `lab4-staging`
- Pull Request: #102 `Feature 43: Implement Actions Taken APIs and authorization`
- Reviewer: `Tanaboonnnnn` reviewed exact head `0d240280db66636d900b447c81a7bc07c47d2a0c`.
- Review status: changes requested on 2026-10-24; re-review pending after feedback commit.
- Comments/responses: reviewer found one evidence blocker: API-04 claimed AC-02/BR-13/BR-33 non-enumeration coverage without explicitly replaying an existing idempotency key from a Requester who does not own the Ticket. The feedback revision adds identical and changed-payload inaccessible replay cases, asserts the same role-forbidden response with no replay/conflict disclosure, and verifies no additional Action row is created.
- TDD evidence: RED commit `cfc1514` contains the Actions Taken API tests before implementation and produced 7/7 failures because the contracted routes did not yet exist; GREEN commit `592f8d33ab52f2cece6f4a58b95b1e9946cb5595` implements the contract and passes the focused API suite.
- Verification: Actions Taken API PostgreSQL suite 7/7 passed on exact GREEN commit; Lab 3 migration regression 1/1 passed; Lab 2 seed regression 1/1 passed; TypeScript server build and `git diff --check` passed.

## Issue #94 Actions Taken Ticket Detail UI

- Branch: `feature/44-lab4-actions-ui`
- Target: `lab4-staging`
- Pull Request: #103 `Feature 44: Add Actions Taken UI to Ticket Detail`
- Reviewer: `Tanaboonnnnn` requested changes on head `34a45b77ab1a4c69ad321b3052a61f50600450fa` and later approved the revised head `01d18a62869852bddc5a0427184b1eb57106bdca` on 2026-10-24.
- Review status: approved and merged into `lab4-staging` as merge commit `4fc051b6940809de133117edf8a4e5412bfa9843`.
- Comments/responses: reviewer found one correctness blocker: an older in-flight Actions request could settle after a Ticket change and overwrite the newer Ticket's history or error state. The feedback revision adds a request-generation guard across success/error/finally transitions, clears stale items on Ticket changes, and adds deterministic stale-success and stale-error React regression cases.
- TDD evidence: RED commit `f2b579e9aaaa992972aff11275d9bc0450af45a5` defines the Actions Taken UI behavior before implementation; GREEN commit `4d26e0e0403a77ebb11894917a27757c2b3bc645` implements the shared Requester/Staff/Admin Ticket Detail UI and client API bindings.
- Verification: after the PR #103 feedback revision, focused Actions Taken UI suite 9/9 passed (including stale-success and stale-error races); Requester/Staff Ticket Detail regression 16/16 passed; full client suite 102/102 passed; client and server builds passed; focused Playwright Staff-to-Requester/read-only plus responsive viewport evidence passed 2/2. Final Human visual/accessibility sign-off remains pending.

## Issue #95 Final Ticket Workflow and Resolution Rules

- Branch: `feature/45-lab4-ticket-workflow`
- Target: `lab4-staging`
- Pull Request: #104 `Feature 45: Finalize Ticket workflow and resolution rules`
- Reviewer: `Tanaboonnnnn` approved exact head `5a8cf4f2819ccd1d9fcbce433cd94a22a9175da0` on 2026-10-24.
- Review status: approved and merged into `lab4-staging` as merge commit `cb821a616bad2efed3566cfe7808879fd1599e2a`.
- Comments/responses: reviewer confirmed the approved transition matrix, current-cycle resolution gate, atomic reopen cycle increment, advisory Requester indication and recoverable Staff UI behavior; no blocking finding remained in the approval review.
- TDD evidence: RED commit `14fdfebd5eefc5dc7719e7d0a3978524c01b4f34` produced 3/6 backend workflow failures and 2/10 UI workflow failures for the missing current-cycle resolution gate, reopen cycle increment, and workflow feedback. GREEN commit `e3075f8b3d92ed14f3d7fea82c37f47ff5ff6d4c` implements the contracted behavior.
- Verification: on the exact GREEN commit, focused Ticket workflow API 6/6 passed; full Lab 4 server suite 15/15 passed; targeted Lab 3/Lab 4 workflow and migration regression 31/31 passed; Ticket workflow UI 10/10 passed; full client suite 112/112 passed; client and server builds passed. Human review was later recorded on GitHub before merge.

## Issue #96 IT Staff Dashboard

- Branch: `feature/46-lab4-staff-dashboard`
- Target: `lab4-staging`
- Pull Request: pending creation after evidence commit.
- Reviewer: pending real peer review.
- Review status: pending.
- Comments/responses: pending. Do not claim approval or reviewer feedback until it exists on GitHub.
- TDD evidence: RED commit `c157e54f7790bb663ca4d1fb534a37f2900e6fb1` produced 2/2 Staff Dashboard API failures (missing endpoint) and 3/3 Staff Dashboard UI failures (missing client contract/route). GREEN commit `b6dbb6e91ad48386287763913772da504aeff1ed` implements the contracted Staff Dashboard.
- Verification: exact GREEN Staff Dashboard API 2/2 passed; full Lab 4 server suite 17/17 passed; Staff Dashboard UI 3/3 passed; full client suite 115/115 passed; server/client builds passed. Human review is pending.
