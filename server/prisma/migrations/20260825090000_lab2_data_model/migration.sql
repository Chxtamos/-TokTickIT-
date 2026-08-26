-- Lab 2 data foundation: requester context, reference data, tickets, and attachments.
CREATE TYPE "RequestedPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TicketStatus" AS ENUM ('NEW');

ALTER TABLE "Category"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "RequesterUser" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequesterUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RelatedSystem" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);

CREATE SEQUENCE "TicketNumberSequence" START 1 INCREMENT 1;

CREATE TABLE "Ticket" (
  "id" SERIAL NOT NULL,
  "ticketNumber" VARCHAR(32) NOT NULL,
  "requesterId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "relatedSystemId" INTEGER NOT NULL,
  "summary" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "requestedPriority" "RequestedPriority" NOT NULL DEFAULT 'MEDIUM',
  "currentStatus" "TicketStatus" NOT NULL DEFAULT 'NEW',
  "clientRequestId" UUID NOT NULL,
  "requestPayloadHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attachment" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "storageKey" UUID NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "removedReason" VARCHAR(250),
  "removedByRequesterId" INTEGER,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Attachment_removal_fields_consistent" CHECK (
    ("removedAt" IS NULL AND "removedReason" IS NULL AND "removedByRequesterId" IS NULL)
    OR
    ("removedAt" IS NOT NULL AND "removedReason" IS NOT NULL AND "removedByRequesterId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "RequesterUser_email_key" ON "RequesterUser"("email");
CREATE UNIQUE INDEX "RelatedSystem_name_key" ON "RelatedSystem"("name");
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE UNIQUE INDEX "Ticket_requesterId_clientRequestId_key" ON "Ticket"("requesterId", "clientRequestId");
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

CREATE INDEX "Ticket_requesterId_updatedAt_id_idx" ON "Ticket"("requesterId", "updatedAt" DESC, "id" DESC);
CREATE INDEX "Ticket_requesterId_categoryId_idx" ON "Ticket"("requesterId", "categoryId");
CREATE INDEX "Ticket_requesterId_relatedSystemId_idx" ON "Ticket"("requesterId", "relatedSystemId");
CREATE INDEX "Ticket_requesterId_requestedPriority_idx" ON "Ticket"("requesterId", "requestedPriority");
CREATE INDEX "Ticket_requesterId_currentStatus_idx" ON "Ticket"("requesterId", "currentStatus");
CREATE INDEX "Attachment_ticketId_uploadedAt_id_idx" ON "Attachment"("ticketId", "uploadedAt", "id");
CREATE INDEX "Attachment_removedByRequesterId_idx" ON "Attachment"("removedByRequesterId");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Ticket_relatedSystemId_fkey" FOREIGN KEY ("relatedSystemId") REFERENCES "RelatedSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Attachment_removedByRequesterId_fkey" FOREIGN KEY ("removedByRequesterId") REFERENCES "RequesterUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
