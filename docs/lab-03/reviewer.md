# Lab 3 Peer Review and Release Record

Prepared 2026-09-15 and updated 2026-09-16. Status: **Changes requested; follow-up correction prepared, re-review/approval/merge pending**. GitHub Issue #51 and PR #68 track this contract. No hosted check, approval or merge is claimed.

## Author and reviewer

- **Author:** Chartanat Upthaipiboon
- **Author student ID:** `67070507210`
- **Author GitHub:** [Chxtamos](https://github.com/Chxtamos)
- **Primary peer reviewer:** [Tanaboonnnnn](https://github.com/Tanaboonnnnn)
- **Peer reviewer name:** Tanboon Teawsawat
- **Peer reviewer student ID:** `67070507211`

The reviewer identity matches the student-confirmed Lab 2 repository record in `docs/lab-02/reviewer.md`. PR #68 has two actual Changes Requested reviews, recorded separately below. Neither is an approval.

## Contract review checklist

- [x] Contract Issue [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51) recorded after creation.
- [x] Contract PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) from `feature/24-lab3-engineering-contract` into `lab3-staging`; reviewed head `afb70d0`.
- [x] Peer reviewed Issue -> specification -> API -> UI -> tests -> workflow and requested changes; actual [review URL](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) recorded.
- [x] PR #68 explicitly linked as a manual GitHub `addCloseIssueReferences` closing reference to Issue #51; GraphQL `closedByPullRequestsReferences` and Project `Linked pull requests` both showed PR #68. This is a Development relationship, not only a mention in the PR body.
- [x] Reviewer name and student ID carried from the student-confirmed repository record and rechecked against `docs/lab-02/reviewer.md`.
- [x] Correction commit [e03f005](https://github.com/Chxtamos/-TokTickIT-/commit/e03f005b49539c471f2b2a5f40519693e7246930) pushed to PR #68 and shown as its head after the first correction round.
- [ ] Record peer response or re-review after this correction; approval is not yet present.
- [ ] Record genuine approval from the review conversation, not an AI-written approval claim.

## Actual PR #68 reviews

| Review | Reviewer | Reviewed head | Verdict | Scope |
| --- | --- | --- | --- | --- |
| [Review `5206436480`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) | Tanaboonnnnn | `afb70d0` | Changes Requested | Logout consistency, staging Issue linkage, terminal owner semantics, project-choice scope, scrypt gate, AC-31 evidence and exact README path |
| [Review `5209846680`](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5209846680) | L0u1sss | `2799d1d` | Changes Requested | Re-review/approval still required, reviewer identity, developer Reflection, explicit Planned/Not run status, future implementation evidence and exact review URL/ID |

## Implementation and release log

Create one row per real PR as work proceeds. Required fields: Issue/PR URL, feature branch/base, reviewed head commit, reviewer identity, substantive comments, response/correction commit, approval URL, check/test evidence, merge commit/date. Final release targets main from lab3-staging; record final main verification revision/results in tests.md.

## PR #68 requested changes and planned response record

| Review point | Contract correction prepared in this branch | Evidence status |
| --- | --- | --- |
| Logout disagreement | BR-11, authorization matrix, API, UI, AC-05 and API-05 use 204 for present/absent/expired/repeated logout; active session still needs CSRF. Review text called this BR-08, but BR-08 is the password policy in the reviewed head. | Corrected in e03f005; re-review pending |
| Staging Issue linkage | PR #68 was linked through GitHub's Development relationship via manual closing reference. `Closes #51` was removed from the PR body; GitHub GraphQL still showed the closing reference afterward. Contract Issue remains Started and PR is PR Review in Project #6. Closing/Done will be based on reviewed staging merge plus evidence, not assumed from the default-main auto-close rule. | Manual GraphQL link verified after PR edit; merge/closure pending |
| Terminal owner | Account-driven cleanup may unassign CLOSED/CANCELLED owners despite forbidden staff terminal owner API. TicketOwnerChange preserves former owner/actor/time atomically; status/resolution history survives. | Implementation/tests planned |
| Project-choice scope | Retained safety decisions are identified as DoD commitments; persisted/distributed throttle storage and backend conversation request-key deduplication are deferred from Lab 3. | Updated contract, implementation pending |
| Scrypt cost | Proposed profile now requires PERF-01 local/CI latency and memory gate before auth coding/freeze. | Benchmark not run; Issue #54 dependency |
| AC-31 evidence | RELEASE-01 now references all 63 planned groups and actual final-main suite/build/regression/migration evidence. | Final audit pending |
| Issue #51 README path | Deliverable is exactly `docs/lab-03/README.md` in the plan and Issue description. | Remote Issue #51 edited; re-review pending |

## Second review response (`5209846680`)

- Peer re-review and approval cannot be authored by the developer or coding agent. This remains pending after the correction is pushed.
- Reviewer identity is now recorded above as Tanboon Teawsawat, student ID `67070507211`, from this repository's student-confirmed record. The mistaken push to another repository contained `67070507210`, which is the author ID here and was not copied.
- `ai-use.md` now contains the developer-written Reflection recovered from the mistaken push; it was not generated or expanded by this correction.
- `tests.md` states at its start and in every one of the 63 test rows that results are `Planned / Not run`; no implementation, passing test, CI or product-completion evidence is claimed.
- Implementation PRs, actual test outputs, screenshots and the final Answer Part 1-9 PDF remain future evidence and are not part of this Engineering Contract PR.
- Review URLs are intentionally distinct and now mapped to their correct reviewer and reviewed head: `5206436480` for Tanaboonnnnn/`afb70d0`, and `5209846680` for L0u1sss/`2799d1d`.

The peer reviewer must re-review the revised contract before implementation depends on these choices. Real approval, implementation PRs, test outputs, screenshots, release PR, final PDF and final-main evidence remain pending. Local document checks are coding-agent checks, never peer-review evidence. Historical Lab 2 approval verifies identity/history only and does not approve this sprint.
