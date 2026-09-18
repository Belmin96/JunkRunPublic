ALTER TABLE "Job" ADD COLUMN "disputeFinancialStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Job" ADD COLUMN "refundAmountCents" INTEGER;
ALTER TABLE "Job" ADD COLUMN "stripeRefundId" TEXT;
CREATE INDEX "Job_disputeFinancialStatus_idx" ON "Job"("disputeFinancialStatus");
