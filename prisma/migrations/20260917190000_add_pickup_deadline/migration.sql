-- Authoritative 45-minute pickup window tracking.
ALTER TABLE "Job" ADD COLUMN "pickupWarningSentAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "pickupDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "autoReturnedAt" TIMESTAMP(3);

CREATE INDEX "Job_status_pickupDeadlineAt_idx" ON "Job"("status", "pickupDeadlineAt");
