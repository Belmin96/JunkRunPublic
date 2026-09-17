ALTER TABLE "Job"
  ADD COLUMN "disputeSubmittedById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledByUserId" TEXT;

CREATE INDEX "Job_disputedAt_idx" ON "Job"("disputedAt");
CREATE INDEX "Job_cancelledAt_idx" ON "Job"("cancelledAt");
