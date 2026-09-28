# Lab 3 Engineering Contract and Release Status

Updated 2026-09-28.

Lab 3 implementation is merged into `lab3-staging` through PR #82. Issue #65 is the remaining release/evidence issue. The release flow is `lab3-staging` -> `main`; Issue #65 must remain open through the merge because its acceptance also requires exact-final-`main` verification, RELEASE-01 evidence, responsive/accessibility/visual evidence, and the single Part 1-9 PDF.

## Documents

| File | Purpose |
| --- | --- |
| [specification.md](specification.md) | Lab 3 FR/BR/AC contract, authorization/workflow rules, data migration/provisioning and Product DoD |
| [api-spec.md](api-spec.md) | Exact endpoints, DTOs, session/cookie/CSRF, errors and concurrency rules |
| [ui-spec.md](ui-spec.md) | Role UI, Zen Green, responsive/accessibility and visual evidence contract |
| [tests.md](tests.md) | Test traceability, observed CI/local evidence and RELEASE-01 requirements |
| [implementation-plan.md](implementation-plan.md) | Historical issue/branch plan and staging flow |
| [reviewer.md](reviewer.md) | Peer-review and release record |
| [ai-use.md](ai-use.md) | Selected AI prompts and student reflection |

## Current Runtime Architecture

- Frontend: React 18 + TypeScript + Vite + Bootstrap.
- Backend: Express + TypeScript + Prisma + PostgreSQL.
- Authentication: email/password with opaque database sessions; normal browser identity comes from the authenticated session.
- Roles: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`.
- Initial-password sessions are restricted and require password change before normal protected access.
- Browser writes use credentialed CORS, trusted Origin checks and CSRF tokens.
- Requester access is owner-scoped; `X-Requester-Id` and the Development Requester selector are not runtime identity mechanisms in Lab 3.
- Staff use the shared queue and operational Ticket Detail, claim/assign/reassign, IT Priority, status workflow, Public Comments and Internal Notes.
- Administrators additionally manage user accounts with version, session-revocation, self-deactivation, last-active-admin and owner-cleanup safety.
- Public Comments and Internal Notes are separate; Internal Notes are never exposed to Requesters.

## Implementation Line

Lab 3 work merged into `lab3-staging` through the implementation/review sequence PR #68-#82. This includes test isolation, migration/seed/provisioning, auth/session APIs, authorization/Requester regression, Staff queue/detail/workflow/conversations, integrated Staff UI and Administrator User Management.

The original #51-#67 issue plan remains historical traceability. Consolidated product work #56, #58 and #63 is complete. The only remaining product/release issue is [#65](https://github.com/Chxtamos/-TokTickIT-/issues/65).

## Current Release State

- `lab3-staging` contains the full implementation line plus the final-integration fixes/evidence work.
- The release PR must use **head `lab3-staging` and base `main`**.
- The release PR must reference #65 without automatically closing it.
- Exact-head pre-release Client/Server/E2E CI must be green before merge.
- After merge, rerun affected checks on the exact final `main` revision, record RELEASE-01/final-main evidence, complete the required responsive/accessibility/visual records, and produce the single Part 1-9 PDF.
- Close #65 only after those post-merge requirements are complete.

## Verification Rules

Database-writing integration and E2E tests require an isolated `TEST_DATABASE_URL`; the target must be PostgreSQL, have a database name containing `test`, and differ from `DATABASE_URL`. Required database suites cannot be counted as passing when skipped locally. Hosted/isolated results are recorded in [tests.md](tests.md).

Before release documentation is finalized, verify FR/BR/AC traceability, referenced test IDs, role/auth/workflow consistency, local Markdown links, build/test results and `git diff --check`. Documentation validation is not a substitute for runtime/security/migration testing.
