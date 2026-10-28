# TokTickIT

TokTickIT is an authenticated IT service desk application for CPE 334 Labs 1-4. It supports three roles: Requester, IT Staff, and Administrator. Requesters create and track their own Tickets and use an owner-scoped Dashboard, IT Staff operate a shared queue, Staff Dashboard, Ticket workflow and Actions Taken, and Administrators reuse operational Staff functions while managing user accounts with safety rules for active administrators and Ticket ownership.

## Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database and ORM: PostgreSQL, Prisma
- Testing: Vitest, Supertest, React Testing Library, Playwright

## Project Structure

```text
toktickit/
+-- client/
|   +-- src/
|   +-- tests/lab-01, lab-02, lab-03, lab-04/
|   +-- e2e/lab-02, lab-03, lab-04/
|   +-- package.json
+-- server/
|   +-- prisma/migrations, schema.prisma, seed.ts
|   +-- scripts/lab3/
|   +-- src/
|   +-- tests/lab-01, lab-02, lab-03, lab-04/
|   +-- package.json
+-- docs/lab-02/
+-- docs/lab-03/
+-- docs/lab-04/
+-- artifacts/
+-- output/
+-- README.md
```

## Prerequisites

Install Node.js/npm, PostgreSQL, and Git.

## Clone and Install

```powershell
git clone https://github.com/Chxtamos/-TokTickIT-.git
cd "-TokTickIT-"
npm --prefix client install
npm --prefix server install
```

## Environment Setup

Copy the examples and keep the resulting `.env` files private:

```powershell
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Configure at least:

```text
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit?schema=public"
CLIENT_ORIGIN="http://127.0.0.1:5173"
```

and in `client/.env`:

```text
VITE_API_URL=http://localhost:3000
```

Authenticated browser requests use cookie sessions, credentialed CORS, exact Origin validation, and CSRF protection on authenticated writes. Do not commit `.env` files, credentials, database passwords, session data, or `node_modules`.

## Database Setup

```powershell
npm --prefix server exec prisma generate
npm --prefix server exec prisma migrate deploy
npm --prefix server run prisma:seed
```

The Lab 4 seed remains repeat-safe. Existing credentials, activation state, Ticket work and operational edits are not overwritten. Lab 4 adds workflow-cycle, Actions Taken/audit fixtures and Dashboard data while preserving earlier records. When synthetic Staff/Admin fixtures need an initial password, set `LAB_SEED_INITIAL_PASSWORD` before seeding. Migrated users without a password hash are provisioned separately with:

```powershell
npm --prefix server run lab3:provision-migrated-users
```

## Running the Application

Backend:

```powershell
npm --prefix server run dev
```

Frontend in another terminal:

```powershell
npm --prefix client run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Authentication and Roles

TokTickIT no longer uses the Lab 2 Development Requester selector or `X-Requester-Id` as runtime identity. Identity comes from the authenticated session.

- **Requester**: use the Requester Dashboard, create Ticket, view only owned Tickets and read-only Actions Taken, manage permitted Attachments, add Public Comments, and indicate that a problem appears resolved.
- **IT Staff**: use the Staff Dashboard and shared queue, view operational Ticket Detail, claim/assign/reassign, set IT Priority, create/update/assign/complete/cancel Actions Taken, perform allowed workflow transitions, add Public Comments and Internal Notes, and download active Attachments.
- **Administrator**: includes Staff operations plus User Management for search/list/create/edit/activate/deactivate/reset-initial-password, with self-deactivation, last-active-admin, session-revocation, version, and owner-cleanup safety rules.

Initial-password sessions require a mandatory password change before normal protected application access.

## REST API

Health:

```http
GET /api/health
```

Authentication includes login, logout, current-session identity, and password change endpoints. Ticket and Attachment APIs are protected by authenticated role/ownership rules. Lab 4 adds Requester/Staff Dashboard reads, Actions Taken APIs, current-cycle workflow resolution rules and audit behavior documented in `docs/lab-04/api-spec.md` while Labs 1-3 APIs remain regression-protected.

Public Comments and Internal Notes are separate resources. Internal Notes are available only to IT Staff and Administrators and must never be projected to Requesters.

## Isolated Integration and E2E Database

Never run database-writing integration/E2E tests against the development database. Use a separate PostgreSQL database whose database name contains `test`.

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/toktickit?schema=public"
$env:TEST_DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/toktickit_test?schema=public"
$env:RUN_DB_INTEGRATION = "1"
$env:LAB_SEED_INITIAL_PASSWORD = "local-lab-only-change-me-2026"

npm --prefix server run prisma:migrate:test
npm --prefix server run prisma:seed:test
npm --prefix server test
npm --prefix client test
npm --prefix client run build
npm --prefix server run build
npm --prefix client run e2e
```

The test guard fails closed for missing, malformed, non-PostgreSQL, or unsafe same-database targets. A different schema in the development database is not sufficient isolation.

## Lab 4 Documentation

The current normative and release documents are:

- `docs/lab-04/specification.md` - Sprint 4 requirements, business rules, authorization, workflow, ACs and Product DoD.
- `docs/lab-04/api-spec.md` - Actions Taken, Dashboard and final workflow API contracts.
- `docs/lab-04/ui-spec.md` - Dashboard/Actions UI, Zen Green, responsive/accessibility and visual evidence contract.
- `docs/lab-04/tests.md` - Labs 1-4 traceability and observed verification evidence.
- `docs/lab-04/reviewer.md` - peer-review and staged integration record.
- `docs/lab-04/ai-use.md` - selected AI-use record and reflection status.

## Historical Lab 3 Documentation

The current normative and release documents are:

- `docs/lab-03/specification.md` - functional/business requirements, authorization/workflow rules, ACs, and Product DoD.
- `docs/lab-03/api-spec.md` - request/response/status/session/CSRF/concurrency contract.
- `docs/lab-03/ui-spec.md` - role UI, Zen Green, responsive/accessibility, and visual evidence contract.
- `docs/lab-03/tests.md` - traceability and observed test/release evidence.
- `docs/lab-03/reviewer.md` - peer-review and release record.
- `docs/lab-03/ai-use.md` - selected AI prompts and student reflection.
- `docs/lab-03/implementation-plan.md` - historical issue/branch plan and staging flow.

Lab 2 documentation remains under `docs/lab-02/` as historical/regression context.

## Release Flow

Lab 4 feature branches merge into `lab4-staging` only after review. The final Lab 4 release PR is **`lab4-staging` -> `main`**. Final release evidence, exact-final-`main` reruns and the required submission PDF remain release work and must not be claimed before they actually occur.
