# TokTickIT Lab 4 Final Submission Evidence

Status: release evidence prepared on `feature/49-lab4-release-evidence`. Final `main` revision, final release PR and exact-final-main CI remain pending until the reviewed `lab4-staging -> main` release is actually merged.

## Answer Part 1: Git Use with Engineering Workflow

Lab 4 uses Issue branches `feature/41` through `feature/49`, peer-reviewed Pull Requests into `lab4-staging`, and a final reviewed `lab4-staging -> main` release. `docs/lab-04/reviewer.md` records the real review history, requested changes and exact approved heads. Implementation/hardening Issues #91-#98 were merged into staging only after review. Issue #99 owns final E2E, evidence synchronization and release integration.

## Answer Part 2: Spec DD

The Sprint 4 engineering contract is in `docs/lab-04/specification.md`, `ui-spec.md` and `api-spec.md`. It defines numbered FRs, BRs and ACs for Actions Taken, immutable audit events, final Ticket lifecycle/resolution gates, workflow cycles, Requester/Staff dashboards, role authorization, parent/child concurrency, migration/backfill, safe errors, responsive/accessibility behavior and Product Definition of Done.

## Answer Part 3: Test DD and Traceability

`docs/lab-04/tests.md` maps AC-01 through AC-22 to unit/API/PostgreSQL/UI/regression/security/responsive/accessibility/performance/E2E/release evidence. Required final E2E files are `client/e2e/lab-04/actions-taken-flow.spec.ts`, `ticket-resolution.spec.ts` and `dashboards.spec.ts`. The release CI workflow runs the complete server/client suites, both builds and every Lab 4 Playwright spec on an isolated PostgreSQL database. Exact-final-main CI evidence is intentionally pending until the final release merge exists.

## Answer Part 4: AI Use with Reflection

`docs/lab-04/ai-use.md` records the actual AI-assisted workflow and selected prompts. AI helped inspect the lab contract, organize requirements, implement/test features, trace review feedback and prepare evidence. Human peer review remained authoritative for requested changes and approval; automated/AI evidence is not substituted for Human visual/accessibility sign-off.

## Answer Part 5: Working Actions Taken

Ticket Detail now shows stable oldest-first Actions Taken history. IT Staff/Administrators can create, assign, edit, complete or cancel permitted Actions while Requesters see the same owned history read-only. Backend actor/time, idempotency, stale-version conflict, follow-up/result validation, immutable creator/time and mutation audit events are covered by API/PostgreSQL/UI tests. Final role/action journey is exercised by `actions-taken-flow.spec.ts`.

## Answer Part 6: Final Ticket Workflow and Resolution

The final transition matrix is backend-enforced. RESOLVED requires a valid Resolution Summary plus at least one current-cycle COMPLETED Action with a valid Result and no non-terminal current-cycle Actions. CLOSED/RESOLVED -> REOPENED increments `workflowCycle`; prior-cycle Actions cannot satisfy a later resolution attempt. `ticket-resolution.spec.ts` exercises failed resolution without evidence, successful resolution, close, reopen, old-cycle rejection and new-cycle resolution.

## Answer Part 7: IT Staff / Administrator Dashboard

The Staff Dashboard provides authoritative backend counts for unassigned Tickets, current-user Tickets and open Actions, status/priority distributions, recent-or-urgent Tickets and current-user Action lists. Cards drill into filtered Queue or Ticket Detail. Administrators reuse the operational Dashboard without weakening User Management authorization. `dashboards.spec.ts` covers Staff and Administrator journeys.

## Answer Part 8: Requester Dashboard

The Requester Dashboard contains only authenticated-owner metrics and bounded recent Ticket lists. Open/Waiting metrics drill into backend-filtered My Tickets and recent entries drill into owned Ticket Detail. Cross-requester data remains non-enumerating. `dashboards.spec.ts` covers the Requester journey.

## Answer Part 9: Zen Green UI, Responsive and Final Evidence

`docs/lab-04/ui-spec.md` remains normative for Zen Green continuity, role-appropriate controls, non-color status cues, semantic labels and visible focus. Automated evidence covers desktop 1440px, tablet 768px, mobile 390px/360px and a 720px 200%-zoom-equivalent layout without document horizontal overflow. Release screenshots are stored under `artifacts/lab-04/screenshots/` for Staff Dashboard, Actions Taken and Requester Dashboard at those viewports. Human visual/accessibility sign-off remains a separate real-person gate and is not fabricated by automated evidence.

## Release Completion Gate

Before Issue #99 can be closed: the #99 feature PR must be reviewed/merged into `lab4-staging`; final staging CI must be green; a reviewed `lab4-staging -> main` release PR must be approved/merged; exact-final-main CI/regression evidence must be recorded; reviewer/test/AI/final-submission records must be synchronized; and all Lab 4 Issues may only then be marked Done.
