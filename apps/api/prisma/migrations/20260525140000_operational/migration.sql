-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "buyPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sellPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2),
    "note" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessMonthId" TEXT,
    "date" DATE NOT NULL,
    "customerName" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechargeEntry" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "operator" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RechargeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferEntry" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJob" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerName" TEXT,
    "device" TEXT,
    "partsCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "labourCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepairJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyTransaction" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "materialIn" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentOut" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE INDEX "Product_userId_idx" ON "Product"("userId");
CREATE INDEX "Product_userId_name_idx" ON "Product"("userId", "name");
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX "Sale_userId_date_idx" ON "Sale"("userId", "date");
CREATE INDEX "Sale_businessMonthId_date_idx" ON "Sale"("businessMonthId", "date");
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");
CREATE INDEX "RechargeEntry_businessMonthId_date_idx" ON "RechargeEntry"("businessMonthId", "date");
CREATE INDEX "TransferEntry_businessMonthId_date_idx" ON "TransferEntry"("businessMonthId", "date");
CREATE INDEX "RepairJob_businessMonthId_date_idx" ON "RepairJob"("businessMonthId", "date");
CREATE UNIQUE INDEX "Party_userId_name_key" ON "Party"("userId", "name");
CREATE INDEX "Party_userId_idx" ON "Party"("userId");
CREATE INDEX "PartyTransaction_businessMonthId_date_idx" ON "PartyTransaction"("businessMonthId", "date");
CREATE INDEX "PartyTransaction_partyId_idx" ON "PartyTransaction"("partyId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RechargeEntry" ADD CONSTRAINT "RechargeEntry_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferEntry" ADD CONSTRAINT "TransferEntry_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Party" ADD CONSTRAINT "Party_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyTransaction" ADD CONSTRAINT "PartyTransaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartyTransaction" ADD CONSTRAINT "PartyTransaction_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
