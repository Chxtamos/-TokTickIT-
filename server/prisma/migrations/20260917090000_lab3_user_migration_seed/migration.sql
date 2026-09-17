-- Lab 3 forward migration.
-- Preserve the Lab 2 RequesterUser rows and all Ticket/Attachment foreign keys.
-- This migration is intentionally forward-only; never use migrate reset here.

CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');
CREATE TYPE "TicketOwnerChangeReason" AS ENUM ('ASSIGNED', 'REASSIGNED', 'ACCOUNT_INELIGIBLE');

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_email_normalized" TO "User_email_normalized";

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "User"
  ADD CONSTRAINT "User_password_state_check"
  CHECK ("passwordHash" IS NOT NULL OR "mustChangePassword" = true),
  ADD CONSTRAINT "User_version_positive_check"
  CHECK ("version" > 0);

ALTER TABLE "Ticket"
  ADD COLUMN "ticketOwnerId" INTEGER,
  ADD COLUMN "itPriority" "RequestedPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolutionSummary" VARCHAR(2000),
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "requesterResolvedAt" TIMESTAMP(3),
  ADD COLUMN "requesterResolvedById" INTEGER,
  ADD COLUMN "lastStatusReason" VARCHAR(250);

UPDATE "Ticket" SET "itPriority" = "requestedPriority";

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_version_positive_check"
    CHECK ("version" > 0),
  ADD CONSTRAINT "Ticket_requester_resolution_pair_check"
    CHECK (("requesterResolvedAt" IS NULL AND "requesterResolvedById" IS NULL)
        OR ("requesterResolvedAt" IS NOT NULL AND "requesterResolvedById" IS NOT NULL));

CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "userId" INTEGER NOT NULL,
  "csrfToken" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketOwnerChange" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "previousOwnerId" INTEGER,
  "nextOwnerId" INTEGER,
  "actorId" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" "TicketOwnerChangeReason" NOT NULL,
  CONSTRAINT "TicketOwnerChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketOwnerChange_shape_check" CHECK (
    ("reason" = 'ASSIGNED' AND "previousOwnerId" IS NULL AND "nextOwnerId" IS NOT NULL)
    OR ("reason" = 'REASSIGNED' AND "previousOwnerId" IS NOT NULL AND "nextOwnerId" IS NOT NULL AND "previousOwnerId" <> "nextOwnerId")
    OR ("reason" = 'ACCOUNT_INELIGIBLE' AND "previousOwnerId" IS NOT NULL AND "nextOwnerId" IS NULL)
  )
);

CREATE TABLE "PublicComment" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" VARCHAR(5000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalNote" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" VARCHAR(5000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "Ticket_ticketOwnerId_updatedAt_id_idx" ON "Ticket"("ticketOwnerId", "updatedAt" DESC, "id" DESC);
CREATE INDEX "Ticket_currentStatus_itPriority_updatedAt_id_idx" ON "Ticket"("currentStatus", "itPriority", "updatedAt" DESC, "id" DESC);
CREATE INDEX "Ticket_requesterResolvedById_idx" ON "Ticket"("requesterResolvedById");
CREATE INDEX "TicketOwnerChange_ticketId_changedAt_id_idx" ON "TicketOwnerChange"("ticketId", "changedAt", "id");
CREATE INDEX "TicketOwnerChange_previousOwnerId_idx" ON "TicketOwnerChange"("previousOwnerId");
CREATE INDEX "TicketOwnerChange_nextOwnerId_idx" ON "TicketOwnerChange"("nextOwnerId");
CREATE INDEX "PublicComment_ticketId_createdAt_id_idx" ON "PublicComment"("ticketId", "createdAt", "id");
CREATE INDEX "PublicComment_authorId_idx" ON "PublicComment"("authorId");
CREATE INDEX "InternalNote_ticketId_createdAt_id_idx" ON "InternalNote"("ticketId", "createdAt", "id");
CREATE INDEX "InternalNote_authorId_idx" ON "InternalNote"("authorId");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_ticketOwnerId_fkey"
    FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Ticket_requesterResolvedById_fkey"
    FOREIGN KEY ("requesterResolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketOwnerChange"
  ADD CONSTRAINT "TicketOwnerChange_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TicketOwnerChange_previousOwnerId_fkey"
    FOREIGN KEY ("previousOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TicketOwnerChange_nextOwnerId_fkey"
    FOREIGN KEY ("nextOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TicketOwnerChange_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PublicComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternalNote"
  ADD CONSTRAINT "InternalNote_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "InternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

