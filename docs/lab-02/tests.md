# Lab 2 Test Plan and Results

## 1. Test Strategy

- **Unit:** formatting, normalization, query parsing, file detection, and business-rule helpers.
- **API/integration:** Express + Prisma/PostgreSQL contracts, database constraints, ownership, validation, failure compensation, and safe errors.
- **UI component:** React behavior using mocked API boundaries, including validation and asynchronous states.
- **UI style/accessibility:** tokens/classes, labels, field states, focus, keyboard behavior, and automated checks where practical.
- **Responsive/visual:** Playwright viewports and Human inspection against `ui-spec.md`.
- **E2E:** real client, server, PostgreSQL, migrations, seed, isolated storage, and complete Requester workflows.

Database tests use a dedicated test database/schema. Attachment tests use a task-specific temporary storage directory and known fixtures; production/user uploads are never used.

### TDD Cycle for Every Implementation Issue

1. Select mapped FR/BR/AC and planned tests.
2. Add the smallest failing tests.
3. Run them and confirm they fail for the expected missing behavior.
4. Implement only the current Issue's scope.
5. Run focused tests until green.
6. Refactor while tests remain green.
7. Run relevant regression suites.
8. Record final results from actual commands only.

## 2. Planned Unit Tests

| ID | Requirement / AC | What it tests | Expected result | Test file | Final |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | BR-11, AC-08 | Ticket Number formatting | Exact `TKT-YYYY-NNNNNN` with padding | `server/tests/lab-02/ticket-number.unit.test.ts` | Planned |
| UNIT-02 | BR-15-BR-17, AC-07 | Summary/Description trimming and boundaries | Exact limits pass; outside/blank fail | `server/tests/lab-02/ticket-validation.unit.test.ts` | Planned |
| UNIT-03 | BR-19-BR-20, AC-09 | Normalized payload hash/idempotency | Equivalent content hashes equally; changes differ | `server/tests/lab-02/ticket-idempotency.unit.test.ts` | Planned |
| UNIT-04 | BR-21-BR-27, AC-14-AC-18 | Ticket-list query parsing/defaults | Valid normalized; invalid/unknown rejected | `server/tests/lab-02/ticket-query.unit.test.ts` | Planned |
| UNIT-05 | BR-29-BR-32, AC-22-AC-23 | Extension/MIME/signature and 5 MiB boundary | Valid accepted; mismatch/oversize rejected | `server/tests/lab-02/attachment-validation.unit.test.ts` | Planned |
| UNIT-06 | BR-33-BR-34, AC-22 | Filename sanitization/storage key | No traversal/control chars; generated UUID key | `server/tests/lab-02/attachment-storage.unit.test.ts` | Planned |

## 3. Planned API and Integration Tests

| ID | Requirement / AC | What it tests | Expected result | Test file | Final |
| --- | --- | --- | --- | --- | --- |
| API-01 | FR-02, BR-04, AC-02 | Active Requester list | `200`, active only, deterministic order | `server/tests/lab-02/requester-context.api.test.ts` | Planned |
| API-02 | FR-02, AC-03 | Empty/failing Requester API | Empty `200 []`; safe `500` | `server/tests/lab-02/requester-context.api.test.ts` | Planned |
| API-03 | BR-05, AC-01, AC-04 | Missing/malformed/inactive/valid context | Invalid `400`; valid accepted | `server/tests/lab-02/requester-context.api.test.ts` | Planned |
| API-04 | FR-08, BR-13, AC-06 | Active Categories/Related Systems | Correct shape, active only, deterministic | `server/tests/lab-02/reference-data.api.test.ts` | Planned |
| API-05 | FR-11, BR-01-BR-02, AC-08 | Valid Ticket creation | `201`; one row; owner/number/`NEW` correct | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-06 | FR-10, BR-14-BR-17, AC-07 | Required fields, enum, trim, boundaries | `400` field errors; no row | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-07 | BR-06, AC-08 | Body attempts owner/system override | `400`; no generated/owner override | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-08 | BR-13, BR-44, AC-07 | Missing/inactive Category/System | `400`; no Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-09 | FR-12, BR-19-BR-20, AC-09-AC-10 | Same request ID/payload replay | First `201`, replay `200`, one Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-10 | BR-20, AC-09 | Same request ID/different payload | `409`; original unchanged | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-11 | BR-01, AC-08 | Concurrent Ticket creation | All committed Ticket Numbers unique | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-12 | FR-13, BR-41, AC-11 | Simulated database failure | Safe `500`; no partial Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-13 | FR-15, BR-07, AC-13 | A/B list isolation | Each response contains its owner only | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-14 | FR-16, BR-21, AC-14 | Case-insensitive Ticket Number/Summary search | Correct owner-scoped matches | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-15 | FR-17, BR-22-BR-23, AC-15 | Combined search/filters | AND semantics | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-16 | FR-18, BR-24-BR-25, AC-16 | Supported sorts/tie ordering | Deterministic exact order | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-17 | FR-19, BR-26, AC-17 | Page boundaries and sizes 10/20/50 | Correct slice/metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-18 | BR-27-BR-28, AC-17, AC-19 | Page beyond final/owner empty | `200` empty with accurate totals | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-19 | FR-20, BR-27, AC-18 | Invalid/unknown query | Safe `400 INVALID_QUERY` | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-20 | FR-20, BR-41, AC-18 | Ticket-list database failure | Safe `500` with no internals | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-21 | FR-22, AC-20 | Owned Ticket Detail | `200`; approved detail/metadata shape | `server/tests/lab-02/ticket-detail.api.test.ts` | PASS |
| API-22 | FR-23, BR-07-BR-08, AC-21 | Missing/cross-owner Ticket | Same safe `404`; no owner data | `server/tests/lab-02/ticket-detail.api.test.ts` | PASS |
| API-23 | FR-25, BR-29-BR-35, AC-22 | Valid types and exact 5 MiB upload | `201`; one active row/file | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |
| API-24 | BR-29-BR-32, AC-23 | Type/signature mismatch and >5 MiB | `415`/`413`; no row/file | `server/tests/lab-02/attachments.api.test.ts` | PASS |
| API-25 | BR-31, AC-23 | Fifth/sixth active Attachment | Fifth accepted; sixth `409`; removed excluded | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |
| API-26 | BR-35, AC-22 | Storage/metadata compensation | Safe `500`; no orphan/active row | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |
| API-27 | FR-26, BR-34, AC-24 | Active owned download | Correct bytes/MIME/name/`nosniff` | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |
| API-28 | FR-27, BR-36-BR-38, AC-25-AC-26 | Valid soft removal | `200`; metadata retained; count decreases | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |
| API-29 | BR-37, AC-25 | Removal-reason boundaries | Invalid `400`; 5/250 accepted; >250 rejected | `server/tests/lab-02/attachments.api.test.ts` | PASS |
| API-30 | FR-28-FR-29, BR-39, AC-26-AC-27 | Removed/non-owned/wrong-Ticket access | Safe `404`; no bytes/mutation | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |
| API-31 | FR-24, BR-38, AC-26 | Metadata after removal | Active/removed states; removed URL null | `server/tests/lab-02/attachments.api.test.ts`, `attachments.postgres.integration.test.ts` | PASS |

## 4. Planned UI, Style, and Accessibility Tests

| ID | Requirement / AC | What it tests | Expected result | Test file | Final |
| --- | --- | --- | --- | --- | --- |
| UI-01 | FR-01, AC-01 | Route guard without Requester | Selector shown; protected screen absent | `client/tests/lab-02/DevelopmentRequesterSelect.test.tsx` | PASS |
| UI-02 | FR-02-FR-03, AC-02-AC-03 | Selector ready/loading/empty/failure | Correct accessible states/Retry | `client/tests/lab-02/DevelopmentRequesterSelect.test.tsx` | PASS |
| UI-03 | FR-04-FR-06, AC-04-AC-05 | Restore/current identity/Change Requester | Header updates; A state cleared; B is revalidated and rendered | `client/tests/lab-02/DevelopmentRequesterSelect.test.tsx` | PASS |
| UI-04 | FR-07-FR-09, AC-06 | Create initial/reference/read-only fields | API data, current Requester, pending values | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-05 | FR-10, BR-14-BR-17, AC-07 | Field validation/focus | Near-field errors; no API call; focus first invalid | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-06 | FR-11, AC-08 | Successful creation | Backend Ticket Number/saved values/next actions | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-07 | FR-12, AC-10 | Busy/disabled Submit | One request; visible busy text | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-08 | FR-13, AC-11 | Create API failure | Safe alert; values/files retained; Retry | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-09 | FR-14, AC-12 | Partial Attachment failure | Ticket success retained; failed file/retry shown | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-10 | BR-29-BR-32, AC-23 | Invalid/sixth selected file | Per-file reason; invalid not submitted | `client/tests/lab-02/CreateTicket.test.tsx` | PASS |
| UI-11 | FR-15, AC-13 | My Tickets owner switch | A disappears; loading then B appears | `client/tests/lab-02/MyTickets.test.tsx` | PASS |
| UI-12 | FR-16-FR-17, AC-14-AC-15 | Search/filters/Clear | Correct query/page reset/preserved controls | `client/tests/lab-02/MyTickets.test.tsx` | PASS |
| UI-13 | FR-18-FR-19, AC-16-AC-17 | Sort/page/page size | Correct query and control states | `client/tests/lab-02/MyTickets.test.tsx` | PASS |
| UI-14 | FR-20, AC-18-AC-19 | Loading/empty/no-results/query/failure | Distinct messages/actions | `client/tests/lab-02/MyTickets.test.tsx` | PASS |
| UI-15 | FR-21, AC-20 | Open Ticket Detail | View Ticket opens the owned Ticket Detail screen | `client/tests/lab-02/MyTickets.test.tsx`, `client/tests/lab-02/RequesterTicketDetail.test.tsx` | PASS |
| UI-16 | FR-22-FR-24, AC-20-AC-21 | Read-only detail/denied state | Approved read-only fields and active/removed Attachment metadata, or safe failure | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | PASS |
| UI-17 | FR-25-FR-26, AC-22-AC-24 | Upload/download states | Busy/success/error/active controls | `client/tests/lab-02/AttachmentSection.test.tsx` | PASS |
| UI-18 | FR-27-FR-28, AC-25-AC-26 | Removal dialog/reason/removed state | Accessible confirm; metadata; actions absent | `client/tests/lab-02/AttachmentSection.test.tsx` | PASS |
| UI-19 | FR-29, AC-27 | Removed/unauthorized/unavailable errors | Safe state; no file/action exposure | `client/tests/lab-02/AttachmentSection.test.tsx` | PASS |
| UI-20 | FR-30-FR-32, AC-28 | Labels/markers/field/button states | Required semantics/classes/text indicators | `client/tests/lab-02/ZenGreenStyle.test.tsx` | PASS |
| UI-21 | AC-28 | Keyboard and semantic accessibility checks | Logical focus, labels, announcements, and text states | `client/tests/lab-02/accessibility.test.tsx` | PASS |

## 5. Planned E2E, Responsive, and Visual Tests

| ID | Requirement / AC | What it tests | Expected result | Test file | Final |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | AC-04, AC-06-AC-12 | Select Requester, create Ticket, mixed files, simulated failure | Backend values, one Ticket, documented recovery | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | AC-13-AC-21 | Create as A, list controls, switch to B, direct A detail | A/B isolation and safe rejection | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | AC-22-AC-27 | Add, download, remove, retained metadata, blocked retry | Complete Attachment lifecycle | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-04 | AC-28-AC-29 | Desktop 1440x900, tablet 820x1180, mobile 390x844 | No clipping/overlap/page scroll; usable controls | `e2e/lab-02/responsive-visual.spec.ts` | Planned |
| E2E-05 | AC-29 | Required screenshots and Human checklist | Artifacts stored and Human-approved | `e2e/lab-02/responsive-visual.spec.ts` | Planned |
| E2E-06 | AC-30 | Full builds/tests/seed/workflow on final main | All required commands pass, no skips | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

## 6. Acceptance-Criterion Traceability

| AC | Planned evidence |
| --- | --- |
| AC-01 | API-03, UI-01 |
| AC-02 | API-01, UI-02 |
| AC-03 | API-02, UI-02 |
| AC-04 | API-03, UI-03, E2E-01 |
| AC-05 | UI-03, UI-11, E2E-02 |
| AC-06 | API-04, UI-04, E2E-01 |
| AC-07 | UNIT-02, API-06-API-08, UI-05 |
| AC-08 | UNIT-01, API-05, API-07, API-11, UI-06, E2E-01 |
| AC-09 | UNIT-03, API-09-API-10 |
| AC-10 | API-09, UI-07, E2E-01 |
| AC-11 | API-12, UI-08, E2E-01 |
| AC-12 | UI-09, E2E-01 |
| AC-13 | API-13, UI-11, E2E-02 |
| AC-14 | UNIT-04, API-14, UI-12, E2E-02 |
| AC-15 | API-15, UI-12, E2E-02 |
| AC-16 | API-16, UI-13, E2E-02 |
| AC-17 | API-17-API-18, UI-13, E2E-02 |
| AC-18 | UNIT-04, API-19-API-20, UI-14 |
| AC-19 | API-18, UI-14, E2E-02 |
| AC-20 | API-21, UI-15-UI-16, E2E-02 |
| AC-21 | API-22, UI-16, E2E-02 |
| AC-22 | UNIT-05-UNIT-06, API-23, API-26, UI-17, E2E-03 |
| AC-23 | UNIT-05, API-24-API-25, UI-10, E2E-01 |
| AC-24 | API-27, UI-17, E2E-03 |
| AC-25 | API-28-API-29, UI-18, E2E-03 |
| AC-26 | API-28, API-31, UI-18, E2E-03 |
| AC-27 | API-30, UI-19, E2E-03 |
| AC-28 | UI-20-UI-21, E2E-04 |
| AC-29 | E2E-04-E2E-05 and Human visual checklist |
| AC-30 | E2E-06 and final command/traceability audit |

## 7. Responsive and Visual Checklist

- [ ] Desktop `1440x900`: centered max-width, multi-column form, full Ticket table.
- [ ] Tablet `820x1180`: two columns where practical; long fields/Attachments have sufficient width.
- [ ] Mobile `390x844`: stacked form, Ticket cards, touch-friendly actions, no page-level horizontal scroll.
- [ ] No clipped labels, messages, badges, filenames, pagination, or navigation.
- [ ] No overlapping dialogs, buttons, cards, or error messages.
- [ ] Editable/read-only/invalid/disabled/focused controls match `ui-spec.md`.
- [ ] Button hierarchy and busy/destructive states are consistent.
- [ ] Empty and no-results states are distinct and actionable.
- [ ] Desktop table/mobile cards contain equivalent information.
- [ ] Attachment states are clear.
- [ ] Keyboard focus is visible and logical.
- [ ] No meaning relies only on color.

## 8. Planned Test Commands

Commands must be updated only if the implemented tooling requires a documented change.

```powershell
# From repository root
npm --prefix server run build
npm --prefix server test
npm --prefix client run build
npm --prefix client test

# Database, from server/
Set-Location server
npx prisma migrate deploy
npm run prisma:seed
npm run prisma:seed
Set-Location ..

# Playwright configured through client/
Set-Location client
npx playwright test
Set-Location ..
```

Focused commands belong in Issue/PR evidence; final evidence must come from complete commands on final `main`.

## 9. Current and Final Results

### Lab 1 Baseline

- Lab 1 documentation reports Server: 2 files/2 tests passed.
- Lab 1 documentation reports Client: 1 file/3 tests passed.
- These results must be rerun as regression evidence when Lab 2 implementation begins.

### Lab 2

**Status:** Feature 17 Zen Green style and accessibility evidence is implemented on branch `feature/17-lab2-style-accessibility`; UI-20/UI-21 coverage, keyboard semantics, responsive card/table behavior, and reduced-motion behavior are included.

### Feature 10 Evidence

- Implementation and integration-test commit: `3e8e6c2`.
- `npm test` with `RUN_DB_INTEGRATION=1`: **42 tests passed**.
- `npm run build`: **passed**.
- PostgreSQL integration covers owned detail, A/B owner isolation, active/removed Attachment ordering, and safe 404 behavior.
- Hosted evidence is provided by GitHub Actions workflow `Server CI` in `.github/workflows/server-ci.yml`; the post-fix run will execute on PR #23 after this branch is pushed.

### Feature 12 Evidence

- Client suite: **11 tests passed total** = 6 Feature 12 requester-selection tests + 2 Requester API shape tests + 3 Lab 1 regression tests updated for the Lab 2 route guard.
- `npm run build` from `client/`: **passed**.
- Coverage includes route guard, active Requester loading/empty/failure states, disabled Continue, response-shape validation, sessionStorage restore, current identity, Change Requester A→B revalidation, and unavailable navigation placeholders.

### Feature 13 Evidence

- Client suite: **24 tests passed total** = 13 Feature 13 Create Ticket tests + 6 Feature 12 requester-selection tests + 2 Requester API shape tests + 3 Lab 1 regression tests.
- `npm test` from `client/`: **passed** (4 test files, 24 tests).
- `npm run build` from `client/`: **passed**.
- Coverage includes active Category/Related System loading, read-only Ticket fields, default Medium priority, field-level validation and first-invalid focus, authoritative Ticket Number, busy/duplicate-submit protection, stable clientRequestId across create retry, fresh clientRequestId for a new Ticket, safe create failure with retained files, cumulative picker/quota behavior, extension/MIME validation, per-file Attachment validation/removal, invalid-file exclusion, and individual retry for partial Attachment failure.

### Feature 14 Evidence

- Client suite: **31 tests passed total** = 7 Feature 14 My Tickets tests + 13 Feature 13 Create Ticket tests + 6 Feature 12 requester-selection tests + 2 Requester API shape tests + 3 Lab 1 regression tests.
- `npm test` from `client/`: **passed** (5 test files, 31 tests).
- `npm run build` from `client/`: **passed**.
- Coverage includes owner-scoped Ticket loading, A→B requester switching without stale data, semantic desktop table and mobile card rendering, `aria-sort` state, labelled loading/no-stale-data state, search/filter AND query reset, clear filters, owner-empty and filtered no-results states, safe retry, page size, and pagination controls.

### Feature 15 Evidence

- Client suite: **36 tests passed total** = 5 Feature 15 Ticket Detail tests + 7 Feature 14 My Tickets tests + 13 Feature 13 Create Ticket tests + 6 Feature 12 requester-selection tests + 2 Requester API shape tests + 3 Lab 1 regression tests.
- `npm test` from `client/`: **passed** (6 test files, 36 tests).
- `npm run build` from `client/`: **passed**.
- Coverage includes View Ticket navigation, owned read-only Ticket fields, Requester context, loading/no-stale-data, safe failure/retry, safe 404 not-found handling without Ticket-data leakage, active/removed Attachment metadata with removal timestamp, no download action before Attachment UI, and back-navigation preserving non-default My Tickets query values.

### Feature 16 Evidence

- Client suite: **45 tests passed total** = 9 Feature 16 Attachment UI tests + 5 Feature 15 Ticket Detail tests + 7 Feature 14 My Tickets tests + 13 Feature 13 Create Ticket tests + 6 Feature 12 requester-selection tests + 2 Requester API shape tests + 3 Lab 1 regression tests.
- `npm test` from `client/`: **passed** (7 test files, 45 tests).
- `npm run build` from `client/`: **passed**.
- Coverage includes active Attachment download with requester context, per-file upload success/failure/retry, cumulative client validation for MIME/type/duplicate files, same-name different-content acceptance, real sixth-file quota visibility, focus trap/Escape/trigger-focus restoration, Removing busy state and duplicate activation prevention, accessible removal dialog with 5-250 character reason validation, removed Attachment action suppression, and safe storage-unavailable messaging.

### Feature 17 Evidence

- Client suite: **54 tests passed total** = 9 Feature 17 Zen Green style/accessibility tests + 9 Feature 16 Attachment UI tests + 5 Feature 15 Ticket Detail tests + 7 Feature 14 My Tickets tests + 13 Feature 13 Create Ticket tests + 6 Feature 12 requester-selection tests + 2 Requester API shape tests + 3 Lab 1 regression tests.
- `npm test` from `client/`: **passed** (9 test files, 54 tests).
- `npm run build` from `client/`: **passed**.
- Coverage includes required markers and programmatic labels, read-only/editable distinction, primary/secondary/busy button states, equivalent desktop table/mobile card content, semantic sort state, active navigation `aria-current`, first-invalid focus, loading `aria-busy`/status announcements, text-labelled priority/status/actions, focus-visible styles, and reduced-motion support.

## 10. Known Limitations and Deferred Tests

- Real authentication/session/token/password/role security belongs to Lab 3; Development Requester tests do not claim real security.
- IT Staff workflows, comments, notes, Actions Taken, and status transitions are excluded.
- Malware scanning and production cloud storage are deferred; Lab 2 still tests type/signature/size/safe naming/non-public storage/ownership/removal.
- Automation does not replace required Human screenshot inspection.

## 11. Human Approval Checklist

- [x] Test IDs and actual intended file paths are approved.
- [x] Every AC has meaningful planned coverage.
- [x] Failure, boundary, ownership, multi-Requester, responsive, and Attachment cases are sufficient.
- [x] No test result is marked Pass before it runs.
- [x] Human agrees that planned tests prove the approved contract rather than AI-generated assumptions.
