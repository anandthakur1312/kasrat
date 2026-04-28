-- Add Clerk identity fields to Owner while preserving existing local seed data.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Owner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Owner" ("id", "clerkUserId", "email", "name", "createdAt")
SELECT "id", 'dev_user_' || "id", "email", "name", "createdAt" FROM "Owner";

DROP TABLE "Owner";
ALTER TABLE "new_Owner" RENAME TO "Owner";

CREATE UNIQUE INDEX "Owner_clerkUserId_key" ON "Owner"("clerkUserId");
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
