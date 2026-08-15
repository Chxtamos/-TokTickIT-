# TokTickIT

TokTickIT is an IT service desk application developed for CPE 334 Lab 1.

## Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database and ORM: PostgreSQL, Prisma
- Testing: Vitest, Supertest, React Testing Library

## Project Structure

```text
toktickit/
├── client/
│   ├── src/
│   ├── tests/
│   │   └── lab-01/
│   │       └── App.test.tsx
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
│   └── lab-01/
│       ├── ai_use.md
│       ├── reviewer.md
│       ├── tests.md
│       └── images/
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

Install the frontend dependencies:

```powershell
cd client
npm install
cd ..
```

Install the backend dependencies:

```powershell
cd server
npm install
cd ..
```

## Environment Setup

Copy the provided environment examples:

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

Seed the four IT request categories:

```powershell
npm run prisma:seed
```

Check the migration status:

```powershell
npx prisma migrate status
```

The seed is idempotent and can run repeatedly without creating duplicate categories.

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

### Category List

```http
GET /api/categories
```

The endpoint returns the four seeded categories in ascending ID order.

## Running Tests

Backend tests:

```powershell
npm --prefix server test
```

Expected result:

```text
Test Files  2 passed (2)
Tests       2 passed (2)
```

Frontend tests:

```powershell
npm --prefix client test
```

Expected result:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```