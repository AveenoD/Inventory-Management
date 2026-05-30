-- CreateEnum
CREATE TYPE "RepairJobStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'REPAIRED_PENDING_PICKUP', 'DELIVERED', 'UNREPAIRABLE_RETURNED');

-- AlterTable
ALTER TABLE "RepairJob" ADD COLUMN     "status" "RepairJobStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "issueDescription" TEXT,
ADD COLUMN     "deliveredAt" DATE,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing completed jobs count as delivered
UPDATE "RepairJob"
SET "status" = 'DELIVERED',
    "deliveredAt" = "date"
WHERE "salePrice" > 0 OR "profit" > 0;

CREATE INDEX "RepairJob_businessMonthId_status_idx" ON "RepairJob"("businessMonthId", "status");
