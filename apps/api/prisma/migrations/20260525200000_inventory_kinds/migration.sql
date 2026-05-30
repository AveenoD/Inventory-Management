-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('MOBILE', 'MOBILE_ACCESSORY', 'REPAIR_PART', 'SPEAKERS_SOUND', 'CHARGER_CABLE');

-- CreateTable
CREATE TABLE "CoverType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverType_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "kind" "ProductKind" NOT NULL DEFAULT 'MOBILE_ACCESSORY',
ADD COLUMN     "phoneModel" TEXT,
ADD COLUMN     "coverTypeId" TEXT,
ADD COLUMN     "partType" TEXT,
ADD COLUMN     "repairCharge" DECIMAL(14,2);

-- CreateIndex
CREATE UNIQUE INDEX "CoverType_userId_name_key" ON "CoverType"("userId", "name");
CREATE INDEX "CoverType_userId_idx" ON "CoverType"("userId");
CREATE INDEX "Product_userId_kind_idx" ON "Product"("userId", "kind");

-- AddForeignKey
ALTER TABLE "CoverType" ADD CONSTRAINT "CoverType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_coverTypeId_fkey" FOREIGN KEY ("coverTypeId") REFERENCES "CoverType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
