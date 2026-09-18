# Lab 3 Peer Review and Release Record

Prepared 2026-09-15 and updated 2026-09-18. The contract review history below is historical for PR #68. Implementation PRs #68-#72 have since been merged/recorded; remaining product work is consolidated in Issues #56, #58, #63 and #65, with documentation synchronization tracked by #73. Do not claim peer approval unless GitHub records an actual APPROVED review.

## Current implementation/release record

| Work | GitHub evidence | Current state |
| --- | --- | --- |
| Engineering Contract | PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) | Merged; Issue #51 Done |
| Test isolation/CI | PR [#69](https://github.com/Chxtamos/-TokTickIT-/pull/69) | Merged; Issue #52 Done |
| Migration/seed/provisioning | PR [#70](https://github.com/Chxtamos/-TokTickIT-/pull/70) | Merged; Issue #53 Done |
| Authentication/session APIs | PR [#71](https://github.com/Chxtamos/-TokTickIT-/pull/71) | Merged; Issue #54 Done |
| Authorization/Requester regression | PR [#72](https://github.com/Chxtamos/-TokTickIT-/pull/72) | Merged; Issue #55 Done |
| Consolidated documentation | Issue [#73](https://github.com/Chxtamos/-TokTickIT-/issues/73) | Started; docs PR still required |

The original Issue plan #51-#67 remains historical. The active product queue is #56, #58, #63 and #65. Closed Issues #57, #59-#62, #64 and #66-#67 are not reused; their scope is represented in the consolidated active Issues.

## Author and reviewer

- **Author:** Chartanat Upthaipiboon
- **Author student ID:** `67070507210`
- **Author GitHub:** [Chxtamos](https://github.com/Chxtamos)
- **Primary peer reviewer:** [Tanaboonnnnn](https://github.com/Tanaboonnnnn)
- **Peer reviewer name:** Tanboon Teawsawat
- **Peer reviewer student ID:** `67070507211`

The reviewer identity matches the student-confirmed Lab 2 repository record in `docs/lab-02/reviewer.md`. PR #68 has four actual Changes Requested reviews, recorded separately below. None is an approval.

## Contract review checklist

- [x] Contract Issue [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51) recorded after creation.
- [x] Contract PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) from `feature/24-lab3-engineering-contract` into `lab3-staging`; reviewed head `afb70d0`.
- [x] Peer reviewed Issue -> specification -> API -> UI -> tests -> workflow and requested changes; actual [review URL](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) recorded.
- [x] PR #68 explicitly linked as a manual GitHub `addCloseIssueReferences` closing reference to Issue #51; GraphQL `closedByPullRequestsReferences` and Project `Linked pull requests` both showed PR #68. This is a Development relationship, not only a mention in the PR body.
- [x] Reviewer name and student ID carried from the student-confirmed repository record and rechecked against `docs/lab-02/reviewer.md`.
- [x] Correction commit [e03f005](https://github.com/Chxtamos/-TokTickIT-/commit/e03f005b49539c471f2b2a5f40519693e7246930) pushed to PR #68 and shown as its head after the first correction round.
- [x] Re-review after the earlier correction recorded as review `5223859584` on head `2bebc7d`; it requested two final auth clarifications and remained Changes Requested.
- [ ] Record genuine approval from the review conversation, not an AI-written approval claim.

## Actual PR #68 reviews

| Review | Reviewer | Reviewed head | Verdict | Scope |
| --- | --- | --- | --- | --- |
| [Review `5206436480`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) | Tanaboonnnnn | `afb70d0` | Changes Requested | Logout consistency, staging Issue linkage, terminal owner semantics, project-choice scope, scrypt gate, AC-31 evidence and exact README path |
| [Review `5209846680`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5209846680) | L0u1sss | `2799d1d` | Changes Requested | Re-review/approval still required, reviewer identity, developer Reflection, explicit Planned/Not run status, future implementation evidence and exact review URL/ID |
| [Review `5223859584`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5223859584) | Tanaboonnnnn | `2bebc7d` | Changes Requested | Exact restricted-session expiry, atomic password/session rotation and manual-unassign scope |
| [Review `5224096566`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5224096566) | Tanaboonnnnn | `730009f` | Changes Requested | Stale manual-unassign wording in Issue #62 and stale unique-key/replay wording in Issue #61 |

## Implementation and release log

Create one row per real PR as work proceeds. Required fields: Issue/PR URL, feature branch/base, reviewed head commit, reviewer identity, substantive comments, response/correction commit, approval URL, check/test evidence, merge commit/date. Final release targets main from lab3-staging; record final main verification revision/results in tests.md.

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
- `tests.md` states at its start and in every one of the 63 test rows that results are `Planned / Not run`; no implementation, passing test, CI or product-completion evidence is claimed.
- Implementation PRs, actual test outputs, screenshots and the final Answer Part 1-9 PDF remain future evidence and are not part of this Engineering Contract PR.
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
