ALTER TABLE "Member" ADD COLUMN "preferredSession" TEXT NOT NULL DEFAULT 'flexible';

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_preferredSession_check"
  CHECK ("preferredSession" IN ('morning', 'evening', 'flexible'));
