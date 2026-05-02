ALTER TABLE "Payment" ADD COLUMN "adjustmentType" TEXT;

UPDATE "Payment" AS p
SET "adjustmentType" =
  CASE
    WHEN p."amount" < m."amountDue" THEN 'discount'
    WHEN p."amount" > m."amountDue" THEN 'custom_amount'
    ELSE NULL
  END
FROM "Membership" AS m
WHERE p."membershipId" = m."id"
  AND p."amount" <> m."amountDue";

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_adjustmentType_check"
  CHECK (
    "adjustmentType" IS NULL
    OR "adjustmentType" IN ('discount', 'custom_amount')
  );
