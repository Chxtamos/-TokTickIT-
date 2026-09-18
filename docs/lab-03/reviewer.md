# Lab 3 Peer Review and Release Record

Prepared 2026-09-15 and updated 2026-09-19. The contract review history below is historical for PR #68. Implementation PRs #68-#72 have since been merged/recorded; remaining product work is tracked by umbrellas #56/#58/#63/#65 and Staff child Issues #59/#62/#60/#61/#75, with documentation synchronization tracked by #73. Do not claim peer approval unless GitHub records an actual APPROVED review.

## Current implementation/release record

| Work | GitHub evidence | Current state |
| --- | --- | --- |
| Engineering Contract | PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) | Merged; Issue #51 Done |
| Test isolation/CI | PR [#69](https://github.com/Chxtamos/-TokTickIT-/pull/69) | Merged; Issue #52 Done |
| Migration/seed/provisioning | PR [#70](https://github.com/Chxtamos/-TokTickIT-/pull/70) | Merged; Issue #53 Done |
| Authentication/session APIs | PR [#71](https://github.com/Chxtamos/-TokTickIT-/pull/71) | Merged; Issue #54 Done |
| Authorization/Requester regression | PR [#72](https://github.com/Chxtamos/-TokTickIT-/pull/72) | Merged; Issue #55 Done |
| Consolidated documentation | Issue [#73](https://github.com/Chxtamos/-TokTickIT-/issues/73) / PR [#74](https://github.com/Chxtamos/-TokTickIT-/pull/74) | Started; PR Review, CI green |

The original Issue plan #51-#67 remains traceable. Umbrella #58 is a tracker only; its stages use child Issues #59, #62, #60, #61 and #75, each with one feature branch and one peer-reviewed PR. Issues #59-#62 were reopened and retargeted; #75 is the new Staff Detail/UI child.

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
| [#74](https://github.com/Chxtamos/-TokTickIT-/pull/74) | `docs/29-lab3-issue-consolidation` -> `lab3-staging`; reviewed Changes Requested on `5f54d91` | Correction commits through `379558f` (`854d82d`, `7d0429a`, `760d8bd`, `52dac8c`, `379558f`); re-review/approval pending | Pending | Correction head `379558f` CI green: Server [run 35373254299](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35373254299), Client [run 35373254258](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35373254258), E2E [run 35373254256](https://github.com/Chxtamos/-TokTickIT-/actions/runs/35373254256) | Open |

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

The review-response sections above describe the state at the time of PR #68 contract review. Current implementation/merge/CI evidence is recorded in the implementation/release table at the top and in tests.md. Final screenshots, release PR, final PDF and final-main evidence remain pending. Local document checks are coding-agent checks, never peer-review evidence. Historical Lab 2 approval verifies identity/history only and does not approve this sprint.
