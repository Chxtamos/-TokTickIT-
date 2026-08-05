# TokTickIT

TokTickIT is an IT service desk application developed for CPE 334 Lab 1.

## Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma
- Testing: Vitest and Supertest

## Prerequisites

- Node.js and npm
- PostgreSQL 17
- Git

## Installation

Install the frontend dependencies:

```bash
cd client
npm install
```

Install the backend dependencies:

```bash
cd server
npm install
```

## Environment Setup

Create local environment files from the provided examples:

```powershell
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Update `server/.env` with your local PostgreSQL connection details.

Never commit `.env` files, database passwords, or `node_modules`.

## Running the Application

Start the backend:

```bash
cd server
npm run dev
```

The backend runs at `http://localhost:3000`.

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in a browser.

## Running Tests

Frontend tests:

```bash
cd client
npm test
```

Backend tests:

```bash
cd server
npm test
```

Some tests are implemented in later Lab 1 Issues and may initially be skipped or fail until those Issues are completed.