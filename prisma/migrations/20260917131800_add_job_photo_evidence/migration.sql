-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "captureSource" TEXT NOT NULL,
    "completionNonce" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPhoto_jobId_createdAt_idx" ON "JobPhoto"("jobId", "createdAt");
CREATE INDEX "JobPhoto_userId_createdAt_idx" ON "JobPhoto"("userId", "createdAt");
CREATE INDEX "JobPhoto_jobId_kind_idx" ON "JobPhoto"("jobId", "kind");

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
