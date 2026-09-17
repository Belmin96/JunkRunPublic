-- Add structured customer questionnaire and hauler repost exclusion tracking.
ALTER TABLE "Job" ADD COLUMN "questionnaire" JSONB;

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
