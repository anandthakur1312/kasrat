-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "clerkUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Owner_clerkUserId_key" ON "Owner"("clerkUserId");
