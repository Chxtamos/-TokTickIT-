# TokTickIT

TokTickIT is a requester-facing IT service desk MVP for CPE 334 Lab 2. A tester selects a seeded Development Requester, creates Tickets, views only owned Tickets, and manages permitted Attachments.

## Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database and ORM: PostgreSQL, Prisma
- Testing: Vitest, Supertest, React Testing Library, Playwright

## Project Structure

```text
toktickit/
├── client/
│   ├── src/
│   ├── tests/
│   │   ├── lab-01/
│   │   └── lab-02/
│   ├── e2e/lab-02/
│   ├── .env.example
│   └── package.json
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   ├── tests/
│   │   └── lab-01/
│   │       ├── health.test.ts
│   │       └── categories.test.ts
│   ├── .env.example
│   └── package.json
├── docs/
│   └── lab-02/
│       ├── ai-use.md
│       ├── api-spec.md
│       ├── reviewer.md
│       ├── specification.md
│       ├── tests.md
│       └── ui-spec.md
├── artifacts/lab-02/screenshots/
├── output/pdf/67070507210_Lab2_Final.pdf
├── .gitignore
└── README.md
```

## Prerequisites

Install the following software before starting:

- Node.js and npm
- PostgreSQL 17
- Git

## Clone the Repository

```powershell
git clone https://github.com/Chxtamos/-TokTickIT-.git
cd "-TokTickIT-"
```

## Install Dependencies

Install frontend dependencies:

```powershell
cd client
npm install
cd ..
```

Install backend dependencies:

```powershell
cd server
npm install
cd ..
```

## Environment Setup

Copy the provided environment examples (do not commit the resulting `.env` files):

```powershell
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Configure `server/.env` with your local PostgreSQL connection:

```text
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/toktickit?schema=public"
```

The frontend API URL can be configured in `client/.env`:

```text
VITE_API_URL=http://localhost:3000
```

Do not commit `.env` files, database passwords, or `node_modules`.

## Database Setup

Create a PostgreSQL database named `toktickit` and provide a database user with access to it. This can be done through pgAdmin or PostgreSQL `psql`.

After configuring `DATABASE_URL`, enter the server directory:

```powershell
cd server
```

Generate the Prisma Client:

```powershell
npx prisma generate
```

Apply the committed database migrations:

```powershell
npx prisma migrate deploy
```

Seed the Lab 2 reference data (safe to run repeatedly):

```powershell
npm run prisma:seed
npm run prisma:seed
```

Check the migration status:

```powershell
npx prisma migrate status
```

The seed is idempotent and can run repeatedly without creating duplicate categories, systems, or Development Requesters.

For development, create a new migration after changing `schema.prisma`:

```powershell
npx prisma migrate dev --name migration-name
```

## Running the Application

Start the backend:

```powershell
cd server
npm run dev
```

The backend runs at:

```text
http://localhost:3000
```

Start the frontend in another terminal:

```powershell
cd client
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

Attachment files are written to a private, non-public directory. Set `ATTACHMENT_STORAGE_DIR` when needed; otherwise the server uses `server/storage/attachments`. Uploaded files and storage paths must never be committed.

## REST API

### Health Check

```http
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "TokTickIT API"
}
```

### Reference Data

```http
GET /api/categories
```

The application exposes active-only Categories, Related Systems, and Development Requesters endpoints. All Ticket and Attachment endpoints require the temporary `X-Requester-Id` context header; this is a Lab 2 test mechanism, not authentication.

### Ticket and Attachment workflows

The REST API supports idempotent Ticket creation, owner-scoped My Tickets and Ticket Detail retrieval, active/removed Attachment metadata, validated upload/download, and soft removal. See `docs/lab-02/api-spec.md` for the normative request/response contract and safe error behavior.

## Running Tests

Backend tests (including PostgreSQL integration):

```powershell
$env:RUN_DB_INTEGRATION="1"
npm --prefix server test
```

Client unit/UI tests:

```powershell
npm --prefix client test
```

Playwright E2E (requires PostgreSQL and Chromium):

```powershell
npx playwright install chromium
npm --prefix client run e2e
```

The final Lab 2 evidence currently records 62 Server tests, 54 Client tests, and 9 Playwright E2E tests passed. Full traceability and screenshot evidence are documented in `docs/lab-02/tests.md` and `artifacts/lab-02/screenshots/`.

## Lab 2 documentation

- `docs/lab-02/specification.md` - approved engineering contract and Definition of Done.
- `docs/lab-02/api-spec.md` - normative REST API contract.
- `docs/lab-02/ui-spec.md` - UI, accessibility, and responsive contract.
- `docs/lab-02/tests.md` - test plan, final results, traceability, and visual checklist.
- `docs/lab-02/reviewer.md` - peer-review and release record.
- `docs/lab-02/ai-use.md` - selected prompts and student reflection.
- `output/pdf/67070507210_Lab2_Final.pdf` - concise final delivery report using Answer Part 1 through Answer Part 9.
