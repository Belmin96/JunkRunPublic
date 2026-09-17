-- Pickup scheduling, GPS arrival verification, and job-level contractor exclusion.
ALTER TABLE "Job" ADD COLUMN "pickupLatitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "pickupLongitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "pickupReminderSentAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "arrivalVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "arrivalLatitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "arrivalLongitude" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "arrivalAccuracyMeters" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN "missedPickupAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "repostedAt" TIMESTAMP(3);

CREATE TABLE "JobHaulerExclusion" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "haulerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'MISSED_PICKUP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobHaulerExclusion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobHaulerExclusion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "JobHaulerExclusion_haulerId_fkey" FOREIGN KEY ("haulerId") REFERENCES "HaulerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JobHaulerExclusion_jobId_haulerId_key" ON "JobHaulerExclusion"("jobId", "haulerId");
CREATE INDEX "JobHaulerExclusion_haulerId_createdAt_idx" ON "JobHaulerExclusion"("haulerId", "createdAt");
CREATE INDEX "Job_status_pickupReminderSentAt_idx" ON "Job"("status", "pickupReminderSentAt");
