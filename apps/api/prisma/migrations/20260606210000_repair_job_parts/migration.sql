-- CreateTable
CREATE TABLE "RepairJobPart" (
    "id" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairJobPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairJobPart_repairJobId_idx" ON "RepairJobPart"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairJobPart_productId_idx" ON "RepairJobPart"("productId");

-- AddForeignKey
ALTER TABLE "RepairJobPart" ADD CONSTRAINT "RepairJobPart_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJobPart" ADD CONSTRAINT "RepairJobPart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
