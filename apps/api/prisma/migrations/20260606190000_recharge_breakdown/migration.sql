-- One recharge transaction stores all profit types on a single row
ALTER TABLE "RechargeEntry" ADD COLUMN "saleProfit" DECIMAL(14,2);
ALTER TABLE "RechargeEntry" ADD COLUMN "chillar" DECIMAL(14,2);
ALTER TABLE "RechargeEntry" ADD COLUMN "act" DECIMAL(14,2);
ALTER TABLE "RechargeEntry" ADD COLUMN "mnp" DECIMAL(14,2);
