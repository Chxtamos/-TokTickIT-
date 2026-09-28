# Lab 3 Peer Review and Release Record

Prepared 2026-09-15 and updated 2026-09-28. The contract review history below is historical for PR #68. Implementation and documentation PRs #68-#82 are now merged into `lab3-staging`; Issue #65 is the only remaining release/final-submission issue. PR #84 is the release PR from `lab3-staging` to `main`. Do not claim peer approval unless GitHub records an actual APPROVED review.

## Current implementation/release record

| Work | GitHub evidence | Current state |
| --- | --- | --- |
| Engineering Contract | PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) | Merged; Issue #51 Done |
| Test isolation/CI | PR [#69](https://github.com/Chxtamos/-TokTickIT-/pull/69) | Merged; Issue #52 Done |
| Migration/seed/provisioning | PR [#70](https://github.com/Chxtamos/-TokTickIT-/pull/70) | Merged; Issue #53 Done |
| Authentication/session APIs | PR [#71](https://github.com/Chxtamos/-TokTickIT-/pull/71) | Merged; Issue #54 Done |
| Authorization/Requester regression | PR [#72](https://github.com/Chxtamos/-TokTickIT-/pull/72) | Merged; Issue #55 Done |
| Consolidated documentation | Issue [#73](https://github.com/Chxtamos/-TokTickIT-/issues/73) / PR [#74](https://github.com/Chxtamos/-TokTickIT-/pull/74) | Merged 2026-09-18; approved on `d132841`; merge `e62e4c` |
| Authenticated Requester UI | PR [#76](https://github.com/Chxtamos/-TokTickIT-/pull/76) | Merged; Issue #56 complete |
| Staff Queue | PR [#77](https://github.com/Chxtamos/-TokTickIT-/pull/77) | Merged; Issue #59 complete |
| Operational Ticket Detail | PR [#78](https://github.com/Chxtamos/-TokTickIT-/pull/78) | Merged; Issue #62 complete |
| Staff Workflow API | PR [#79](https://github.com/Chxtamos/-TokTickIT-/pull/79) | Merged; Issue #60 complete |
| Comments / Internal Notes API | PR [#80](https://github.com/Chxtamos/-TokTickIT-/pull/80) | Merged; Issue #61 complete |
| Staff Detail/UI integration | PR [#81](https://github.com/Chxtamos/-TokTickIT-/pull/81) | Merged; Issue #75 complete |
| Administrator User Management | PR [#82](https://github.com/Chxtamos/-TokTickIT-/pull/82) | Merged; Issue #63 complete |
| Final Lab 3 release | PR [#84](https://github.com/Chxtamos/-TokTickIT-/pull/84) | Changes Requested on reviewed head `da67aeb`; merge pending |

The original Issue plan #51-#67 remains traceable. Umbrella #58 is a tracker only; its stages were completed through child Issues #59, #62, #60, #61 and #75, each with its own feature branch and PR. #56, #58 and #63 are complete; #65 remains open for release, final-main verification and final submission evidence.

## Author and reviewer

- **Author:** Chartanat Upthaipiboon
- **Author student ID:** `67070507210`
- **Author GitHub:** [Chxtamos](https://github.com/Chxtamos)
- **Primary peer reviewer:** [Tanaboonnnnn](https://github.com/Tanaboonnnnn)
- **Peer reviewer name:** Tanboon Teawsawat
- **Peer reviewer student ID:** `67070507211`

The reviewer identity matches the student-confirmed Lab 2 repository record in `docs/lab-02/reviewer.md`. PR #68 has four Changes Requested reviews and a final APPROVED review, recorded below.

## Contract review checklist

- [x] Contract Issue [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51) recorded after creation.
- [x] Contract PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) from `feature/24-lab3-engineering-contract` into `lab3-staging`; reviewed head `afb70d0`.
- [x] Peer reviewed Issue -> specification -> API -> UI -> tests -> workflow and requested changes; actual [review URL](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) recorded.
- [x] PR #68 explicitly linked as a manual GitHub `addCloseIssueReferences` closing reference to Issue #51; GraphQL `closedByPullRequestsReferences` and Project `Linked pull requests` both showed PR #68. This is a Development relationship, not only a mention in the PR body.
- [x] Reviewer name and student ID carried from the student-confirmed repository record and rechecked against `docs/lab-02/reviewer.md`.
- [x] Correction commit [e03f005](https://github.com/Chxtamos/-TokTickIT-/commit/e03f005b49539c471f2b2a5f40519693e7246930) pushed to PR #68 and shown as its head after the first correction round.
- [x] Re-review after the earlier correction recorded as review `5223859584` on head `2bebc7d`; it requested two final auth clarifications and remained Changes Requested.
- [x] Record genuine approval from the review conversation, not an AI-written approval claim: [review 5224214289](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5224214289), Tanaboonnnnn, reviewed head `7f67ed4`.

## Actual PR #68 reviews

| Review | Reviewer | Reviewed head | Verdict | Scope |
| --- | --- | --- | --- | --- |
| [Review `5206436480`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) | Tanaboonnnnn | `afb70d0` | Changes Requested | Logout consistency, staging Issue linkage, terminal owner semantics, project-choice scope, scrypt gate, AC-31 evidence and exact README path |
| [Review `5209846680`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5209846680) | L0u1sss | `2799d1d` | Changes Requested | Re-review/approval still required, reviewer identity, developer Reflection, explicit Planned/Not run status, future implementation evidence and exact review URL/ID |
| [Review `5223859584`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5223859584) | Tanaboonnnnn | `2bebc7d` | Changes Requested | Exact restricted-session expiry, atomic password/session rotation and manual-unassign scope |
| [Review `5224096566`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5224096566) | Tanaboonnnnn | `730009f` | Changes Requested | Stale manual-unassign wording in Issue #62 and stale unique-key/replay wording in Issue #61 |
| [Review `5224214289`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5224214289) | Tanaboonnnnn | `7f67ed4` | Approved | All contract blockers resolved; polish wording remained non-blocking |

## Implementation and release log

Create one row per real PR as work proceeds. Required fields: Issue/PR URL, feature branch/base, reviewed head commit, reviewer identity, substantive comments, response/correction commit, approval URL, check/test evidence, merge commit/date. Final release targets main from lab3-staging; record final main verification revision/results in tests.md.

| PR | Branch/base and reviewed head | Reviewer/review response | Approval | CI evidence | Merge |
| --- | --- | --- | --- | --- | --- |
| [#69](https://github.com/Chxtamos/-TokTickIT-/pull/69) | `feature/25-lab3-test-isolation-ci` -> `lab3-staging`, `38d4e46` | Tanaboonnnnn requested changes on `6e494f4`; corrected and re-reviewed | Tanaboonnnnn approved in [review 5226274842](https://github.com/Chxtamos/-TokTickIT-/pull/69#pullrequestreview-5226274842) on `38d4e46` | Client/Server/E2E CI passed; Server run [35118612409](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35118612409) | Merge `d6be2e5`, 2026-09-16 |
| [#70](https://github.com/Chxtamos/-TokTickIT-/pull/70) | `feature/26-lab3-user-migration-seed` -> `lab3-staging`, `db69ab3` | Peepipat-Suesoongnuen requested fixture/evidence fixes on `719de19`; corrected in `af7654a`/`db69ab3` | Peepipat-Suesoongnuen approved in [review 5236215911](https://github.com/Chxtamos/-TokTickIT-/pull/70#pullrequestreview-5236215911) on `db69ab3` | Client/Server/E2E CI passed; Server run [35221030054](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35221030054) | Merge `5819368`, 2026-09-17 |
| [#71](https://github.com/Chxtamos/-TokTickIT-/pull/71) | `feature/27-lab3-auth-sessions` -> `lab3-staging`, `cc0c743` | chaproi requested changes on `7a040b7`; corrected through auth/CI fixes | Tanaboonnnnn approved in [review 5239139332](https://github.com/Chxtamos/-TokTickIT-/pull/71#pullrequestreview-5239139332) on `cc0c743` | Client/Server/E2E CI passed; Server run [35250890637](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35250890637) | Merge `74586fc`, 2026-09-17 |
| [#72](https://github.com/Chxtamos/-TokTickIT-/pull/72) | `feature/28-lab3-requester-authorization` -> `lab3-staging`, `3a28e39` | Peepipat-Suesoongnuen/L0u1sss requested changes on earlier heads; corrected fail-closed adapter and authenticated mock tests | L0u1sss approved in [review 5249118396](https://github.com/Chxtamos/-TokTickIT-/pull/72#pullrequestreview-5249118396) on `3a28e39` | Client/Server/E2E CI passed; Server run [35357859386](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35357859386) | Merge `07c7a75`, 2026-09-18 |
| [#74](https://github.com/Chxtamos/-TokTickIT-/pull/74) | `docs/29-lab3-issue-consolidation` -> `lab3-staging`, final reviewed head `d132841` | cottonlnwza requested changes on `5f54d91` and `52dac8c`; child-Issue mapping and evidence were corrected through `d132841` | cottonlnwza approved on `d132841` in review `PRR_kwDOTuo9Bs8AAAABOPmb-A` | Final-head CI green: Server `35373542119`, Client `35373542112`, E2E `35373542145` | Merge `e62e4c`, 2026-09-18 |
| [#81](https://github.com/Chxtamos/-TokTickIT-/pull/81) | `feature/34-lab3-staff-detail-ui` -> `lab3-staging`, final head `1a09fb1` | Staff Detail/UI feedback and CI failures corrected before merge | Merged after review | Client/Server/E2E checks green on merged implementation line | Merge `9cfa1cf`, 2026-09-24 |
| [#82](https://github.com/Chxtamos/-TokTickIT-/pull/82) | `feature/35-lab3-admin-user-management` -> `lab3-staging`, `ff149aa` | Administrator API/UI/PostgreSQL/E2E implementation; review complete before merge | Merged after review | Client `36142262695` 93/93, Server `36142262536` 219/219, E2E `36142262756` 20/20 | Merge `3bcb4a9`, 2026-09-25 |
| [#84](https://github.com/Chxtamos/-TokTickIT-/pull/84) | `lab3-staging` -> `main`, reviewed head `da67aeb` | Tanaboonnnnn requested changes on `da67aeb`: clarify RELEASE-01/Product-DoD lifecycle, sync stale #74/header history, and sync this release row to exact-head CI. This correction branch addresses those points without claiming approval. | Changes Requested; re-review pending | Exact reviewed head `da67aeb` green: Client run `36438376365` (#126), Server run `36438376111` (#139), E2E run `36438376574` (#108) | Pending |

## PR #68 requested changes and planned response record

| Review point | Contract correction prepared in this branch | Evidence status |
| --- | --- | --- |
| Logout disagreement | BR-11, authorization matrix, API, UI, AC-05 and API-05 use 204 for present/absent/expired/repeated logout; active session still needs CSRF. Review text called this BR-08, but BR-08 is the password policy in the reviewed head. | Corrected in e03f005; re-review pending |
| Staging Issue linkage | PR #68 was linked through GitHub's Development relationship via manual closing reference. `Closes #51` was removed from the PR body; GitHub GraphQL showed the closing reference during the contract review. | Historical review-time state; PR #68 is now merged and Issue #51 is Done |
| Terminal owner | Account-driven cleanup may unassign CLOSED/CANCELLED owners despite forbidden staff terminal owner API. TicketOwnerChange preserves former owner/actor/time atomically; status/resolution history survives. | Implementation/tests planned |
| Project-choice scope | Retained safety decisions are identified as DoD commitments; persisted/distributed throttle storage and backend conversation request-key deduplication are deferred from Lab 3. | Updated contract, implementation pending |
| Scrypt cost | Proposed profile now requires PERF-01 local/CI latency and memory gate before auth coding/freeze. | Completed in PR #71; actual local/CI benchmark evidence is recorded in tests.md |
| AC-31 evidence | RELEASE-01 now references all 63 planned groups and actual final-main suite/build/regression/migration evidence. | Final audit pending |
| Issue #51 README path | Deliverable is exactly `docs/lab-03/README.md` in the plan and Issue description. | Remote Issue #51 edited; re-review pending |

## Second review response (`5209846680`)

- Peer re-review and approval cannot be authored by the developer or coding agent. This remains pending after the correction is pushed.
- Reviewer identity is now recorded above as Tanboon Teawsawat, student ID `67070507211`, from this repository's student-confirmed record. The mistaken push to another repository contained `67070507210`, which is the author ID here and was not copied.
- `ai-use.md` now contains the developer-written Reflection recovered from the mistaken push; it was not generated or expanded by this correction.
- At contract-review time, `tests.md` stated all 63 rows were `Planned / Not run`; later implementation PRs added evidence in subsequent revisions.
- At contract-review time, implementation PRs, actual test outputs, screenshots and the final Answer Part 1-9 PDF were future evidence; current implementation evidence is recorded in the implementation log above.
- Review URLs are intentionally distinct and now mapped to their correct reviewer and reviewed head: `5206436480` for Tanaboonnnnn/`afb70d0`, and `5209846680` for L0u1sss/`2799d1d`.

## Third review response (`5223859584`)

- Restricted initial-password sessions now set expiresAt to issuance+15 minutes, have no idle timeout, never update lastSeenAt and expire exactly when `now >= expiresAt`. API-02 covers just-before, exact-boundary, after-boundary and no-extension behavior.
- Password change now derives secrets before a single PostgreSQL transaction that rechecks the snapshot, updates credentials, revokes all old sessions and inserts one replacement normal session. Any database-step failure rolls back all changes; Set-Cookie occurs only after commit, and post-commit delivery failure recovers through new-password Login. API-03 covers fault rollback and lost-response recovery.
- The non-blocking scope point was accepted: Staff manual unassign and nullable owner writes were removed from FR/BR/AC, API, UI, tests and Issue #60. Account-ineligibility cleanup remains the only owner-to-null path because it preserves the active-owner invariant and TicketOwnerChange attribution.
- These are contract/test changes only. The boundary, fault-injection and recovery cases remain `Planned / Not run` pending implementation.

## Fourth review response (`5224096566`)

- Issue 12 in `implementation-plan.md` and live Issue #62 now say Claim/Assign/Reassign and explicitly exclude Staff manual unassign, matching FR-12, BR-22, AC-15, API and UI.
- Issue 11 acceptance wording and live Issue #61 no longer mention PostgreSQL unique-key/replay. They require append semantics, chronological ordering, terminal-state access, ambiguous-retry list refresh and parent/projection isolation, matching the deferred-deduplication contract.
- The normative contract was already correct; this correction removes stale implementation handoff wording so a coding agent cannot reintroduce the old scope.

The review-response sections above describe the state at the time of PR #68 contract review. Current implementation through PR #82 is merged into `lab3-staging` and recorded in this table and `tests.md`. The current release review requested documentation/lifecycle corrections before approval. Final-main rerun, RELEASE-01 completion and the single Part 1-9 PDF remain post-merge Issue #65 work; Issue #65 must remain open until those records are complete. Local document checks are coding-agent checks, never peer-review evidence. Historical Lab 2 approval verifies identity/history only and does not approve this sprint.
