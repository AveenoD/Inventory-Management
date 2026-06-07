-- Performance indexes for hot query paths
CREATE INDEX "Product_userId_isActive_idx" ON "Product"("userId", "isActive");
CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");
CREATE INDEX "RechargeEntry_businessMonthId_date_isActive_idx" ON "RechargeEntry"("businessMonthId", "date", "isActive");
CREATE INDEX "RepairJob_businessMonthId_status_deliveredAt_idx" ON "RepairJob"("businessMonthId", "status", "deliveredAt");
