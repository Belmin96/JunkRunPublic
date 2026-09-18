-- Make Stripe webhook processing retryable and auditable.
ALTER TABLE "StripeEvent"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "StripeEvent"
SET "status" = 'PROCESSED'
WHERE "processedAt" IS NOT NULL;

ALTER TABLE "StripeEvent"
  ALTER COLUMN "processedAt" DROP NOT NULL,
  ALTER COLUMN "processedAt" DROP DEFAULT;

CREATE INDEX "StripeEvent_type_status_idx" ON "StripeEvent"("type", "status");
CREATE INDEX "StripeEvent_status_updatedAt_idx" ON "StripeEvent"("status", "updatedAt");
