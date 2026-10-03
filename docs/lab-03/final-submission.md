# TokTickIT Lab 3 Final Submission Evidence

Final released main revision used as the product baseline: `55d80fe109eec03e683e394da2a51a1e59ddb5c4`.
Post-release evidence/fix PR: #86 (`docs/38-lab3-final-submission`).

## Answer Part 1: Git Use with Engineering Workflow

Lab 3 used feature branches and peer-reviewed PRs into `lab3-staging`, followed by release PR #84 from `lab3-staging` to `main`. PR #84 was approved on corrected head `aa45eb7` and merged as `55d80fe` on 2026-10-02. The implementation/review history is rendered from `docs/lab-03/reviewer.md`; it records reviewer identity, requested changes, correction evidence, approvals, CI and merge commits for the real PR set. Issue #65 is deliberately reopened while post-release evidence PR #86 is under review; the Project item is Started and PR #86 is PR Review. It must become Done only after the final evidence PR is reviewed/merged and the human visual checklist is signed off.

Links: repository https://github.com/Chxtamos/-TokTickIT- ; release PR https://github.com/Chxtamos/-TokTickIT-/pull/84 ; evidence PR https://github.com/Chxtamos/-TokTickIT-/pull/86 ; Project https://github.com/users/Chxtamos/projects/6 .

## Answer Part 2: Spec DD

The Sprint 3 contract is in `docs/lab-03/specification.md`, `ui-spec.md`, and `api-spec.md`. It defines the Sprint Goal, scope/exclusions, numbered FRs and BRs, the Requester/IT Staff/Administrator authorization matrix, authenticated ownership, migration from Development Requester identity, password/session decisions, Ticket workflow, Public Comments versus Internal Notes, Administrator safety rules, AC-01 through AC-32, and Product Definition of Done. The contract was created and reviewed before the main implementation sequence; PR #68 is the contract review record.

## Answer Part 3: Test DD and Traceability

`docs/lab-03/tests.md` is the source-of-truth test plan and AC-to-test index. Exact final `main` `55d80fe` evidence: Client CI #134 / run 37054900319 passed 15 files and 93 tests plus production build; Server CI #147 / run 37054900447 applied all four migrations, ran PostgreSQL integration, passed 30 files and 219 tests plus server build; E2E CI #116 / run 37054900427 ran migrations, seed twice, isolated credential provisioning, and passed 20/20 Playwright tests. Post-release evidence head `8bd84be` passes Client #137, Server #150, and E2E #119 with 25/25 Playwright tests including the final responsive capture suite.

## Answer Part 4: AI Use with Reflection

`docs/lab-03/ai-use.md` records the AI workflow and ten selected real prompts. Earlier implementation used the Codex desktop coding agent where the exact model identifier was not exposed; the final evidence pass also used ChatGPT GPT-5.6 Sol. The student's original `My Reflection` remains in that file unchanged in substance. It explains that AI was useful for reading the lab sheet, organizing requirements/specification/API/UI/test planning, while Human-in-the-loop and peer review were necessary because early requirements and generated interpretations needed verification and correction against the Lab 3 handout.

## Answer Part 5: Working Login and Password Change UI

Authentication evidence covers valid/invalid credentials, inactive accounts, mandatory initial-password change, authenticated user/role display, logout and post-logout denial. API tests also cover restricted-session and normal-session expiry boundaries, CSRF/session rotation and safe failures. The screenshot set includes the Login screen at desktop, tablet, mobile and zoom-equivalent layouts. E2E-01 is covered by `client/e2e/lab-03/authentication.spec.ts`.

## Answer Part 6: Working IT Staff Ticket Queue UI

The Staff Queue supports realistic data, search, filters, sorting, pagination, ownership/status/priority presentation, open-detail navigation, no-results/failure states and responsive card/table layouts. The final evidence suite captures the queue at 1440, 768, 390 and 360 widths plus the 200%-zoom-equivalent layout. Queue E2E behavior is covered by `client/e2e/lab-03/staff-queue.spec.ts`.

## Answer Part 7: Working IT Staff Ticket Detail UI

Staff Ticket Detail demonstrates claim/reassign ownership, IT Priority, permitted status changes, Public Comments, private Internal Notes, Attachment continuity, validation/conflict handling and role restrictions. Direct authorization tests prove Requesters cannot retrieve Internal Notes and protected resources do not leak existence. `client/e2e/lab-03/staff-ticket-flow.spec.ts` and server Lab 3 authorization/workflow suites provide automated evidence; final screenshots capture Operational Controls and the visibly distinct Internal Notes area.

## Answer Part 8: Working Administrator User Management UI

User Management provides Name/Email/Role/Status/Edit, search, role filter, create, edit, activation/deactivation and new initial-password behavior. Tests cover duplicate email/invalid input, one-role assignment, self-deactivation prevention, last-active-Administrator protection, session revocation and forbidden access for non-Administrators. `client/e2e/lab-03/admin-user-management.spec.ts` provides E2E-04 evidence. The 360px audit exposed a real overflow defect in Administrator cards; PR #86 fixes it and the rerun passes.

## Answer Part 9: Zen Green UI and Responsive Evidence

`docs/lab-03/ui-spec.md` defines the Zen Green visual/accessibility contract. PR #86 adds deterministic evidence for 1440, 768, 390 and 360 CSS-pixel widths and a 200%-zoom-equivalent 720 CSS-pixel layout. It captures Login, Requester My Tickets, Staff Queue, Staff Ticket Detail and Administrator User Management and asserts no document-level horizontal overflow. The first audit exposed two real defects (Requester at 768 and Administrator cards at 360); both were corrected before the green evidence run. Screenshot contact sheets are included in the PDF and the original PNGs are stored under `artifacts/lab-03/screenshots/`.

Important completion note: the automated evidence and screenshots are complete, but the handout/contract requires a human visual/accessibility checklist. The coding agent does not fabricate a human sign-off. A student or peer reviewer must inspect the stored screenshots for design consistency, role navigation, badges, editable/read-only styling, validation placement, focus, clipping, overlap, horizontal overflow and absence of secret/Internal Note leakage, then record that sign-off before Issue #65/Product DoD is finally closed.
