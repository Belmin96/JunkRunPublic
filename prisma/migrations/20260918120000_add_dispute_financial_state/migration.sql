ALTER TABLE "Job" ADD COLUMN "disputeFinancialStatus" TEXT NOT NULL DEFAULT 'NONE';
CREATE INDEX "Job_disputeFinancialStatus_idx" ON "Job"("disputeFinancialStatus");