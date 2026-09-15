# Lab 3 Peer Review and Release Record

Prepared 2026-09-15. Status: **Changes requested; correction in progress, approval/merge pending**. GitHub Issue #51 and PR #68 track this contract. No remote check, approval or merge is claimed yet.

## Author and reviewer

Author carried forward from the existing Lab 2 repository record: Chartanat Upthaipiboon, student ID 67070507210, GitHub [Chxtamos](https://github.com/Chxtamos). PR #68 received an actual [Changes Requested review](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) from GitHub user [Tanaboonnnnn](https://github.com/Tanaboonnnnn) on 2026-09-15 06:39:42 UTC against head `afb70d0`. The reviewer identity/student ID for final submission should still be confirmed by the student; this review is not an approval.

## Contract review checklist

- [x] Contract Issue [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51) recorded after creation.
- [x] Contract PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) from `feature/24-lab3-engineering-contract` into `lab3-staging`; reviewed head `afb70d0`.
- [x] Peer reviewed Issue -> specification -> API -> UI -> tests -> workflow and requested changes; actual [review URL](https://github.com/Chxtamos/-TokTickIT-/pull/68#pullrequestreview-5206436480) recorded.
- [x] PR #68 explicitly linked as a manual GitHub `addCloseIssueReferences` closing reference to Issue #51; GraphQL `closedByPullRequestsReferences` and Project `Linked pull requests` both showed PR #68. This is a Development relationship, not only a mention in the PR body.
- [ ] Confirm reviewer name/student ID for final submission with the student.
- [ ] Record correction commit/head, peer response or re-review after this contract update is pushed.
- [ ] Record genuine approval from the review conversation, not an AI-written approval claim.

## Implementation and release log

Create one row per real PR as work proceeds. Required fields: Issue/PR URL, feature branch/base, reviewed head commit, reviewer identity, substantive comments, response/correction commit, approval URL, check/test evidence, merge commit/date. Final release targets main from lab3-staging; record final main verification revision/results in tests.md.

## PR #68 requested changes and planned response record

| Review point | Contract correction prepared in this branch | Evidence status |
| --- | --- | --- |
| Logout disagreement | BR-11, authorization matrix, API, UI, AC-05 and API-05 use 204 for present/absent/expired/repeated logout; active session still needs CSRF. Review text called this BR-08, but BR-08 is the password policy in the reviewed head. | Correction commit and re-review pending |
| Staging Issue linkage | PR #68 was linked through GitHub's Development relationship via manual closing reference. The `Closes #51` keyword is being removed from the PR body; contract Issue remains Started and PR is PR Review in Project #6. Closing/Done will be based on reviewed staging merge plus evidence, not assumed from the default-main auto-close rule. | Manual GraphQL link verified; merge/closure pending |
| Terminal owner | Account-driven cleanup may unassign CLOSED/CANCELLED owners despite forbidden staff terminal owner API. TicketOwnerChange preserves former owner/actor/time atomically; status/resolution history survives. | Implementation/tests planned |
| Project-choice scope | Retained safety decisions are identified as DoD commitments; persisted/distributed throttle storage and backend conversation request-key deduplication are deferred from Lab 3. | Updated contract, implementation pending |
| Scrypt cost | Proposed profile now requires PERF-01 local/CI latency and memory gate before auth coding/freeze. | Benchmark not run; Issue #54 dependency |
| AC-31 evidence | RELEASE-01 now references all 63 planned groups and actual final-main suite/build/regression/migration evidence. | Final audit pending |
| Issue #51 README path | Deliverable is exactly `docs/lab-03/README.md` in the plan and Issue description. | Remote Issue edit pending |

The student/reviewer must confirm the revised contract before implementation depends on these choices. Real approval, implementation PRs, release PR and final-main evidence remain pending. Local document checks are coding-agent checks, never peer-review evidence. Historical Lab 2 approvals remain in docs/lab-02/reviewer.md and do not approve this sprint.
