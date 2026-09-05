-- Requester emails are stored as the canonical lower-case, trimmed value.
-- The preceding migration has already been applied, so this invariant is added
-- in its own forward-only migration.
UPDATE "RequesterUser"
SET "email" = lower(btrim("email"));

ALTER TABLE "RequesterUser"
  ADD CONSTRAINT "RequesterUser_email_normalized"
  CHECK ("email" = lower(btrim("email")));
