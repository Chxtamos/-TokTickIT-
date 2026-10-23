-- Lab 4 Actions Taken data foundation.
-- Forward-only additive migration: preserve all Labs 1-3 rows and relations.

CREATE TYPE "ActionTakenStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionTakenEventType" AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'STATUS_CHANGED');

ALTER TABLE "Ticket"
  ADD COLUMN "workflowCycle" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_workflowCycle_positive_check"
  CHECK ("workflowCycle" > 0);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "workflowCycle" INTEGER NOT NULL DEFAULT 1,
  "performedById" INTEGER NOT NULL,
  "assigneeId" INTEGER,
  "description" VARCHAR(2000) NOT NULL,
  "result" VARCHAR(2000),
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" VARCHAR(1000),
  "attachmentNotes" VARCHAR(1000),
  "status" "ActionTakenStatus" NOT NULL DEFAULT 'PENDING',
  "clientRequestId" UUID NOT NULL,
  "requestPayloadHash" CHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_workflowCycle_positive_check" CHECK ("workflowCycle" > 0),
  CONSTRAINT "ActionTaken_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "ActionTaken_description_nonblank_check" CHECK (char_length(btrim("description")) >= 5),
  CONSTRAINT "ActionTaken_result_completion_check" CHECK (
    "status" <> 'COMPLETED' OR (
      "result" IS NOT NULL
      AND char_length(btrim("result")) >= 5
      AND "followUpRequired" = false
    )
  ),
  CONSTRAINT "ActionTaken_followup_shape_check" CHECK (
    ("followUpRequired" = true AND "followUpNote" IS NOT NULL AND char_length(btrim("followUpNote")) >= 5)
    OR ("followUpRequired" = false AND "followUpNote" IS NULL)
  )
);

CREATE TABLE "ActionTakenEvent" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "eventType" "ActionTakenEventType" NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "changedFields" JSONB NOT NULL,
  "fromStatus" "ActionTakenStatus",
  "toStatus" "ActionTakenStatus",
  "previousAssigneeId" INTEGER,
  "nextAssigneeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionTakenEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTakenEvent_resultingVersion_positive_check" CHECK ("resultingVersion" > 0),
  CONSTRAINT "ActionTakenEvent_changedFields_array_check" CHECK (jsonb_typeof("changedFields") = 'array')
);

CREATE UNIQUE INDEX "ActionTaken_ticketId_clientRequestId_key"
  ON "ActionTaken"("ticketId", "clientRequestId");
CREATE INDEX "ActionTaken_ticketId_workflowCycle_createdAt_id_idx"
  ON "ActionTaken"("ticketId", "workflowCycle", "createdAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_id_idx"
  ON "ActionTaken"("assigneeId", "status", "updatedAt" DESC, "id" DESC);
CREATE INDEX "ActionTaken_performedById_updatedAt_id_idx"
  ON "ActionTaken"("performedById", "updatedAt" DESC, "id" DESC);

CREATE UNIQUE INDEX "ActionTakenEvent_actionId_resultingVersion_key"
  ON "ActionTakenEvent"("actionId", "resultingVersion");
CREATE INDEX "ActionTakenEvent_actionId_createdAt_id_idx"
  ON "ActionTakenEvent"("actionId", "createdAt", "id");
CREATE INDEX "ActionTakenEvent_actorId_createdAt_id_idx"
  ON "ActionTakenEvent"("actorId", "createdAt", "id");

ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTaken_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActionTakenEvent"
  ADD CONSTRAINT "ActionTakenEvent_actionId_fkey"
    FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTakenEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTakenEvent_previousAssigneeId_fkey"
    FOREIGN KEY ("previousAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTakenEvent_nextAssigneeId_fkey"
    FOREIGN KEY ("nextAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
