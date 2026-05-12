-- Issue #16: app-owned gym membership model.
-- Adds GymUser/GymInvite/GymAccessRequest, platform-admin flag, and gym
-- approval audit columns. Backfills GymUser{role:admin} for every existing
-- gym so live access keeps working immediately after this migration runs.

-- ---------- Owner ----------
ALTER TABLE "Owner" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- ---------- Gym ----------
ALTER TABLE "Gym" ADD COLUMN "status"         TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Gym" ADD COLUMN "normalizedName" TEXT;
ALTER TABLE "Gym" ADD COLUMN "approvedById"   TEXT;
ALTER TABLE "Gym" ADD COLUMN "approvedAt"     TIMESTAMP(3);

ALTER TABLE "Gym"
  ADD CONSTRAINT "Gym_status_check"
  CHECK ("status" IN ('pending', 'active', 'rejected'));

ALTER TABLE "Gym"
  ADD CONSTRAINT "Gym_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "Owner"("id");

-- Existing rows: treat them as already-active gyms approved at creation time.
UPDATE "Gym"
SET "approvedAt"     = "createdAt",
    "approvedById"   = "ownerId",
    "normalizedName" = lower(trim("name"));

-- ---------- GymUser ----------
CREATE TABLE "GymUser" (
  "id"        TEXT          NOT NULL,
  "gymId"     TEXT          NOT NULL,
  "ownerId"   TEXT          NOT NULL,
  "role"      TEXT          NOT NULL,
  "status"    TEXT          NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt"  TIMESTAMP(3),
  CONSTRAINT "GymUser_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GymUser" ADD CONSTRAINT "GymUser_role_check"   CHECK ("role"   IN ('admin', 'staff'));
ALTER TABLE "GymUser" ADD CONSTRAINT "GymUser_status_check" CHECK ("status" IN ('active', 'disabled'));

CREATE UNIQUE INDEX "GymUser_gymId_ownerId_key" ON "GymUser"("gymId", "ownerId");
CREATE INDEX        "GymUser_gymId_idx"          ON "GymUser"("gymId");
CREATE INDEX        "GymUser_ownerId_idx"        ON "GymUser"("ownerId");

ALTER TABLE "GymUser"
  ADD CONSTRAINT "GymUser_gymId_fkey"
  FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT;
ALTER TABLE "GymUser"
  ADD CONSTRAINT "GymUser_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT;

-- Backfill: every existing gym → GymUser{role:admin} for its creator. Uses
-- random hex so ids are unique without needing a sequence.
INSERT INTO "GymUser" ("id", "gymId", "ownerId", "role", "status", "createdAt", "joinedAt")
SELECT
  'gymuser_' || substr(md5(random()::text || clock_timestamp()::text || g."id"), 1, 16),
  g."id",
  g."ownerId",
  'admin',
  'active',
  g."createdAt",
  g."createdAt"
FROM "Gym" g;

-- ---------- GymInvite ----------
CREATE TABLE "GymInvite" (
  "id"           TEXT          NOT NULL,
  "gymId"        TEXT          NOT NULL,
  "email"        TEXT          NOT NULL,
  "role"         TEXT          NOT NULL,
  "status"       TEXT          NOT NULL DEFAULT 'pending',
  "tokenHash"    TEXT          NOT NULL,
  "invitedById"  TEXT,
  "acceptedById" TEXT,
  "expiresAt"    TIMESTAMP(3)  NOT NULL,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"   TIMESTAMP(3),
  CONSTRAINT "GymInvite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GymInvite" ADD CONSTRAINT "GymInvite_role_check"   CHECK ("role"   IN ('admin', 'staff'));
ALTER TABLE "GymInvite" ADD CONSTRAINT "GymInvite_status_check" CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired'));

CREATE UNIQUE INDEX "GymInvite_tokenHash_key" ON "GymInvite"("tokenHash");
CREATE INDEX        "GymInvite_gymId_idx"     ON "GymInvite"("gymId");
CREATE INDEX        "GymInvite_email_idx"     ON "GymInvite"("email");
CREATE INDEX        "GymInvite_status_idx"    ON "GymInvite"("status");

ALTER TABLE "GymInvite"
  ADD CONSTRAINT "GymInvite_gymId_fkey"
  FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE;
ALTER TABLE "GymInvite"
  ADD CONSTRAINT "GymInvite_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "Owner"("id") ON DELETE SET NULL;
ALTER TABLE "GymInvite"
  ADD CONSTRAINT "GymInvite_acceptedById_fkey"
  FOREIGN KEY ("acceptedById") REFERENCES "Owner"("id") ON DELETE SET NULL;

-- ---------- GymAccessRequest ----------
CREATE TABLE "GymAccessRequest" (
  "id"           TEXT          NOT NULL,
  "ownerId"      TEXT          NOT NULL,
  "gymName"      TEXT          NOT NULL,
  "contactPhone" TEXT          NOT NULL,
  "address"      TEXT          NOT NULL,
  "note"         TEXT,
  "status"       TEXT          NOT NULL DEFAULT 'pending',
  "reviewedById" TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GymAccessRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GymAccessRequest"
  ADD CONSTRAINT "GymAccessRequest_status_check"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'duplicate'));

CREATE INDEX "GymAccessRequest_status_idx"  ON "GymAccessRequest"("status");
CREATE INDEX "GymAccessRequest_ownerId_idx" ON "GymAccessRequest"("ownerId");

ALTER TABLE "GymAccessRequest"
  ADD CONSTRAINT "GymAccessRequest_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT;
ALTER TABLE "GymAccessRequest"
  ADD CONSTRAINT "GymAccessRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "Owner"("id") ON DELETE SET NULL;
