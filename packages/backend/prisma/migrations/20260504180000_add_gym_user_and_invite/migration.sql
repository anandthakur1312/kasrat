-- Issue #16: shared gym access via GymUser; admin-issued invites via GymInvite.

CREATE TABLE "GymUser" (
  "id"        TEXT          PRIMARY KEY,
  "gymId"     TEXT          NOT NULL,
  "ownerId"   TEXT          NOT NULL,
  "role"      TEXT          NOT NULL,
  "status"    TEXT          NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GymUser_gym_fkey"   FOREIGN KEY ("gymId")   REFERENCES "Gym"("id"),
  CONSTRAINT "GymUser_owner_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id"),
  CONSTRAINT "GymUser_role_check"   CHECK ("role"   IN ('admin', 'staff')),
  CONSTRAINT "GymUser_status_check" CHECK ("status" IN ('active', 'disabled'))
);

CREATE UNIQUE INDEX "GymUser_gymId_ownerId_key" ON "GymUser" ("gymId", "ownerId");
CREATE INDEX "GymUser_ownerId_idx" ON "GymUser" ("ownerId");
CREATE INDEX "GymUser_gymId_idx"   ON "GymUser" ("gymId");

-- Backfill: every existing gym's owner becomes its first admin.
INSERT INTO "GymUser" ("id", "gymId", "ownerId", "role", "status", "createdAt", "joinedAt")
SELECT
  'gymuser-' || g."id",
  g."id",
  g."ownerId",
  'admin',
  'active',
  g."createdAt",
  g."createdAt"
FROM "Gym" g;

CREATE TABLE "GymInvite" (
  "id"           TEXT          PRIMARY KEY,
  "gymId"        TEXT          NOT NULL,
  "email"        TEXT          NOT NULL,
  "role"        TEXT          NOT NULL,
  "status"       TEXT          NOT NULL DEFAULT 'pending',
  "tokenHash"    TEXT          NOT NULL,
  "invitedById"  TEXT          NOT NULL,
  "acceptedById" TEXT,
  "expiresAt"    TIMESTAMP(3)  NOT NULL,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"   TIMESTAMP(3),
  CONSTRAINT "GymInvite_gym_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id"),
  CONSTRAINT "GymInvite_role_check"   CHECK ("role"   IN ('admin', 'staff')),
  CONSTRAINT "GymInvite_status_check" CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired'))
);

CREATE UNIQUE INDEX "GymInvite_tokenHash_key" ON "GymInvite" ("tokenHash");
CREATE INDEX "GymInvite_gymId_idx" ON "GymInvite" ("gymId");
CREATE INDEX "GymInvite_email_idx" ON "GymInvite" ("email");
