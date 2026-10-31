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
- Pull Request: #105 `Feature 46: Build IT Staff dashboard`
- Reviewer: `Tanaboonnnnn` requested changes on head `f5b8adc394bba916de837fe66b387e305f7ac2b8` and later approved exact revised head `943beba57725d5b9d4be4b39d063d9f61fe9d70d` on 2026-10-25.
- Review status: approved and merged into `lab4-staging` as merge commit `fcacf00797eba093460f233d7fcb91c71d2f7338`.
- Comments/responses: reviewer identified two behavioral blockers. First, `recentOrUrgent` incorrectly grouped all priority levels before recency instead of placing only URGENT first and ordering every non-URGENT Ticket by `updatedAt DESC, id DESC`. Second, the `My Open Actions` card linked to `myRecentActions`, which could omit the assigned PENDING/IN_PROGRESS Actions counted by the metric. The feedback revision now fills the 10-ticket list with URGENT Tickets first and recency-ordered non-URGENT Tickets for remaining slots, adds a dedicated `myOpenActionItems` dataset for assigned PENDING/IN_PROGRESS Actions, and points the metric card at that exact list.
- TDD evidence: RED commit `c157e54f7790bb663ca4d1fb534a37f2900e6fb1` produced 2/2 Staff Dashboard API failures (missing endpoint) and 3/3 Staff Dashboard UI failures (missing client contract/route). GREEN commit `b6dbb6e91ad48386287763913772da504aeff1ed` implements the contracted Staff Dashboard.
- Verification: after the PR #105 feedback revision, Staff Dashboard API 2/2 passed with PostgreSQL ordering/take-10 and open-Action drill-down assertions; full Lab 4 server suite 17/17 passed; Staff Dashboard UI 4/4 passed including an open Action intentionally displaced from `myRecentActions`; full client suite 116/116 passed; server/client builds and `git diff --check` passed. Human approval was later recorded on the exact revised head before merge.

## Issue #97 Requester Dashboard

- Branch: `feature/47-lab4-requester-dashboard`
- Target: `lab4-staging`
- Pull Request: #106 `Feature 47: Build Requester dashboard`
- Reviewer: `Tanaboonnnnn` approved exact head `97644ecb8f3a57093415368d9fb4d1219d0152a2` on 2026-10-27.
- Review status: approved and merged into `lab4-staging` as merge commit `922dd6c04a58799b365d7414df8192d642e477a0`.
- Comments/responses: reviewer found no confirmed blocker and explicitly noted that Human visual/accessibility sign-off remains separate.
- TDD evidence: RED commit `9b69dca8ecaeac2594cd73a0c8a35f07f864aa09` produced 2/2 API failures for the missing endpoint and 4/4 UI failures for the missing client Dashboard contract/route.
- Verification: pre-commit GREEN verification passes Requester Dashboard API 2/2, full Lab 4 server 19/19, Lab 2 My Tickets API regression 6/6, Requester Dashboard UI 4/4, Change Password regression 6/6, full client 120/120, server/client builds and `git diff --check`; Human approval was later recorded before merge.

## Issue #98 Final Hardening

- Branch: `feature/48-lab4-final-hardening`
- Target: `lab4-staging`
- Pull Request: #107 `Feature 48: Complete Lab 4 final hardening`
- Reviewer: `Peepipat-Suesoongnuen` requested changes on the hardening branch, re-reviewed the follow-up revisions, and approved exact head `6835ab760c0bd382d4159a80e94f033259d39a31` on 2026-10-31.
- Review status: approved and merged into `lab4-staging` as merge commit `82ae707ea32e37a98e4900870ec6d13338dd4c04`.
- Comments/responses: Human visual/accessibility review remains a separate real-person gate and must not be replaced by automated evidence.
- Review feedback on 2026-10-31: `Peepipat-Suesoongnuen` requested (1) CI evidence on the current PR head, (2) completion of Human visual/accessibility sign-off, and (3) fail-loud Administrator cleanup instead of `.catch(() => undefined)`.
- Fix response: PR CI is now defined in `.github/workflows/lab4-ci.yml` to run the full server/client suites, both builds and focused Lab 4 Playwright against an isolated PostgreSQL test database. Administrator cleanup now restores pre-existing state transactionally, throws on restore failure, and verifies the restored `id/isActive/version` snapshot before disconnecting. Human visual/accessibility confirmation remains explicitly pending until a real person performs and records it.
- Re-review feedback on 2026-10-31: reviewer confirmed CI on exact head `65202c5b05c9f9d800bcd836230c75f5c93870e8` and fail-loud cleanup, but rejected the remaining design because the suite still temporarily deactivated shared Administrator rows before restoring them, creating a possible cross-file race under parallel Vitest execution.
- Second fix response: `users-admin.postgres.integration.test.ts` now provisions an entire temporary PostgreSQL database dedicated to that test file. Migrations and the normal seed run inside the temporary database; all Administrator role/deactivation and concurrency mutations occur only there. The shared `TEST_DATABASE_URL` Administrator rows are never changed by this suite. Teardown disconnects every suite client, terminates remaining connections to the temporary database and drops the database. The parallel reproducer (`users-admin` + `seed-provisioning`) passes 4/4 and the full default-parallel server suite passes 242/242.
- Final re-review: reviewer confirmed Test Isolation, cleanup and exact-head CI/regression on `6835ab760c0bd382d4159a80e94f033259d39a31`; no blocker remained in PR #107 scope. Human visual/accessibility evidence remains explicitly separate and was not treated as automated approval.
- RED/hardening evidence: commit `be7f6d9` adds responsive/keyboard checks while the existing Lab 4 Staff E2E path still expected the pre-#96 Ticket Queue landing; the existing Actions Taken E2E consequently failed 2/2 until the shared harness/journey was hardened.
- Verification: focused authorization 3/3, performance smoke 1/1, automated accessibility 2/2, Lab 4 E2E Actions/Responsive 5/5, full client 122/122, full server 242/242, and server/client builds passed. A full server run initially exposed a real test-isolation leak in the Lab 3 Administrator PostgreSQL suite; the suite now snapshots/restores pre-existing Administrator active/version state and the reproducer plus full server suite pass.

### Human visual/accessibility checklist (requires real Human sign-off)

The person performing final sign-off must inspect Staff Dashboard, Requester Dashboard and Actions Taken at 1440px, 768px, 390px and 360px, plus the 200%-zoom-equivalent layout, and record PASS/FAIL for: readable hierarchy; Zen Green consistency; role-appropriate controls; editable/read-only distinction; validation placement; keyboard focus visibility/order; labels/landmarks; non-color status cues; clipping/overlap; and document-level horizontal overflow. Automated Playwright/accessibility checks are supporting evidence only and are not recorded as Human approval.

## Issue #99 E2E, Release Integration and Final Evidence

- Branch: `feature/49-lab4-release-evidence`
- Starting reviewed staging revision: `82ae707ea32e37a98e4900870ec6d13338dd4c04`.
- Target: `lab4-staging` first; only after review/merge and green staging CI may a reviewed `lab4-staging -> main` release proceed.
- Pull Request: #108 `Feature 49: Complete Lab 4 E2E and release evidence`.
- Reviewer: `Peepipat-Suesoongnuen` requested changes on exact head `36de8fb6f8c856b8e777533e8380b415e995e47f` on 2026-10-31.
- Review status: changes requested; third re-review pending after verification/status evidence is synchronized to the new exact head.
- Comments/responses: the first review identified two evidence-ordering defects in `docs/lab-04/ai-use.md`: duplicated item number `14` and a chronology error that placed the PR #107 merge/Issue #99 start before the second PR #107 review fix. Commit `3cf39f2d2e9051ccab33f5ee8694cb07657b59aa` corrected both. The second review identified a release-E2E Assignment gap; commit `9456567ca12353f4ea1afd189651a58c5386159e` asserts initial assignment, reassignment to `E2E Administrator`, immutable `performedBy`, and Requester read-only persistence. The third review on head `9456567ca12353f4ea1afd189651a58c5386159e` confirmed CI was green but requested (1) a test-plan status header that distinguishes passed automated E2E from pending final-main release verification and pending Human visual/accessibility sign-off, and (2) a PR verification summary tied to the actual current head with Local Verification and GitHub Actions CI reported separately. The follow-up implements that evidence separation without marking either pending final gate complete.
- Verification before PR creation: required final E2E acceptance specs pass 5/5; complete Lab 4 Playwright directory passes 11/11; full server passes 242/242; full client passes 122/122; server/client builds pass; screenshots are generated for Staff Dashboard, Actions Taken and Requester Dashboard at 1440/768/390/360/720 widths.
- Release status: not released to `main`. `RELEASE-01`, exact-final-main CI and final-main evidence remain pending and must not be marked complete before the reviewed release actually lands.
- Release PR: #109 `Release Lab 4: merge reviewed staging into main`, head `lab4-staging`, base `main`.
- Initial release-PR CI on staging head `017a1113b14f52f0e5d4a84bc5f0e565c6437608`: Client CI, Server CI and Lab 4 CI passed; `E2E CI` run `41218100293` failed because legacy Lab 3 Staff E2E still assumed the pre-#96 Ticket Queue landing. After updating those regressions, one additional legacy flow correctly exposed the newer Lab 4 resolution gate because it attempted RESOLVED without current-cycle completed Action evidence.
- Release E2E fix response: branch `fix/49-lab4-release-e2e-regression`, fix commit `35e5180`. Legacy Staff E2E now verifies `IT Staff Dashboard` landing and explicitly navigates to Ticket Queue where required; the integrated Lab 3 workflow creates/completes an Action with a valid Result before resolving; `E2E CI` is also configured to run on `lab4-staging` PRs/pushes. Exact fix verification passes the four affected specs 13/13 and the complete E2E suite 36/36 locally. The fix still requires review/merge into staging before release PR #109 can be considered green.
