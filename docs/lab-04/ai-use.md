# Lab 4 AI Use Record

## Model / agent use

ChatGPT was used as a specification/coding assistant. This record must contain only prompts and outcomes that actually occurred.

## Selected prompts so far

1. Asked the agent to read Lab 4 in detail and decompose the sprint into no more than ten GitHub Issues.
2. Asked the agent to define the order of work from baseline verification through staged release and final evidence.
3. Asked the agent to inspect the existing repository, verify the Lab 3 baseline, create the Lab 4 Issues, establish a safe `lab4-staging` baseline, and begin Issue #91 while checking the current branch/remote before every push or commit.
4. Asked the agent to read the real human review feedback on PR #100 and revise the engineering contract consistently before implementation, including resolution evidence, reopen cycles, parent/child concurrency, idempotency disclosure, and Action mutation audit semantics.
5. Asked the agent to address the real human feedback on PR #101. The follow-up work added a genuine Lab-3-baseline-to-Lab-4 migration/backfill test, lifecycle-realistic seeded Action audit history, full-seed non-destructive evidence, and corrected reviewer records.
6. Asked the agent to continue with Issue #93 after PR #101 merged. The agent implemented Actions Taken list/create/update APIs, backend role/ownership/CSRF enforcement, validation, idempotency, concurrency/version handling, lifecycle rules, audit events, and PostgreSQL API tests while preserving a real RED test commit before the GREEN implementation.
7. Asked the agent to continue with Issue #94 after PR #102 merged. The agent added a shared Actions Taken Ticket Detail UI for Requester/IT Staff/Administrator roles, client API bindings, recoverable create/edit/conflict behavior, responsive Zen Green styling, UI tests and focused Playwright viewport/role evidence while preserving a RED test commit before implementation.
8. Asked the agent to address the real human feedback on PR #103. The follow-up work guards Actions Taken fetches against stale cross-ticket success/error responses and adds deterministic deferred-promise regression tests for both race outcomes.
9. Asked the agent to continue after PR #103 merged. The agent started Issue #95 from the exact merged `lab4-staging` baseline, preserved a RED test commit, then implemented the final Ticket transition/resolution gate, workflow-cycle increment on reopen, advisory Requester indication behavior, workflow UI guidance and regression-compatible Lab 3 fixtures.
10. Asked the agent to continue after PR #104 merged. The agent verified the real approval/merge, closed Issue #95, started Issue #96 from the exact merged staging commit, preserved RED Dashboard tests, then implemented the backend-authoritative IT Staff/Admin Dashboard with metrics, status/priority distributions, bounded Ticket/Action lists, Queue/Detail drill-downs, feedback states and responsive UI.
11. Asked the agent to address the real human feedback on PR #105. The follow-up work corrected BR-23 ordering so only URGENT outranks recency, added direct PostgreSQL regression coverage for the 10-item ordering boundary, and changed the My Open Actions drill-down to a dedicated assigned PENDING/IN_PROGRESS dataset with a regression proving the open work remains discoverable even when newer completed history displaces it from My Recent Actions.
12. Asked the agent to continue after PR #105 merged. The agent verified the real approval/merge, closed Issue #96, started Issue #97 from the exact merged staging commit, preserved RED Requester Dashboard tests, then implemented the backend-authoritative owner-scoped Dashboard, bounded recent lists, role/query protection, Dashboard navigation and drill-downs while preserving the approved Lab 3 Requester landing behavior.
13. Asked the agent to continue after PR #106 merged. The agent verified the real approval/merge, closed Issue #97, started Issue #98 from exact staging commit `922dd6c`, added responsive/keyboard/security/accessibility/performance hardening coverage, repaired the E2E harness so fixture provisioning and CORS no longer depend on shell-only state, updated the Staff journey for the approved Dashboard landing, fixed a discovered cross-test Administrator-state leak, refreshed README Lab 4 setup/context, and reran full server/client plus focused Lab 4 E2E. Automated evidence is not represented as Human visual/accessibility approval.
14. Asked the agent to address the second real review on PR #107. The reviewer accepted exact-head CI and fail-loud cleanup but identified a remaining parallel test-isolation race because the Administrator safety suite still mutated shared Administrator rows. The follow-up moved that entire PostgreSQL integration suite onto a per-file temporary database that is migrated/seeded independently and dropped at teardown, preserving the real last-active-admin concurrency test without modifying shared test fixtures.
15. Asked the agent to continue after PR #107 merged, read the next Issue and Lab content, and perform the remaining work. The agent verified the real approval/merge, closed Issue #98, started Issue #99 from exact reviewed staging merge `82ae707`, added the three required final E2E specs, expanded CI to every Lab 4 Playwright spec, generated required viewport screenshots, prepared Part 1-9 submission evidence, and ran full server/client/build/E2E verification. Final staging/main release claims remain pending until their real reviewed merges and CI runs exist.
16. Asked the agent to address the next real review on PR #108 after carefully verifying the feedback. The reviewer requested explicit release-E2E proof for Action assignment. The follow-up adds assertions for the assignee saved at Action creation, exercises reassignment from E2E Staff to E2E Administrator, confirms the immutable performer remains E2E Staff, and verifies the persisted reassignment again from the Requester read-only history.

## Current use and limitations

The agent translated the handout into an engineering-contract draft and made explicit project decisions where the handout leaves details open. Those decisions require normal peer review; AI output is not reviewer approval, test evidence, or human visual/accessibility sign-off.

## My Reflection

Pending student-authored reflection before final submission.
