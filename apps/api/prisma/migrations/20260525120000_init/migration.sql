-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMonth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransferDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dmt99Dmt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt99Aeps" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt99Nepal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt99BillPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt99Qr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86Dmt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86Aeps" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86Credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86BillPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86Wallet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86Qr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dmt86Nepal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "imeAeps" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "imeNepal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "MoneyTransferDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechargeDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "airtelSaleProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "airtelChillar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "airtelAct" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "airtelMnp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "jioSaleProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "jioChillar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "jioAct" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "jioMnp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "viSaleProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "viChillar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "viAct" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "viMnp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bsnlSaleProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bsnlChillar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bsnlAct" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bsnlMnp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allInOneSaleProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allInOneChillar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "RechargeDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "sale" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "RepairDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileAccessoryDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sale" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "MobileAccessoryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraIncomeEntry" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ExtraIncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopExpenseDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "salaryDescription" TEXT,
    "salaryAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "teaDescription" TEXT,
    "teaAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shopExpDescription" TEXT,
    "shopExpAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ShopExpenseDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "accessoriesDescription" TEXT,
    "accessoriesAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "repairingDescription" TEXT,
    "repairingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DamageDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyLedgerEntry" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "partyName" TEXT NOT NULL,
    "materialIn" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentOut" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PartyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UdhharDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "paymentOut" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentIn" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "UdhharDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBalanceDay" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "directAc" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salesQr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transferQr" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "BankBalanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "businessMonthId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bank" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BusinessMonth_userId_idx" ON "BusinessMonth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMonth_userId_year_month_key" ON "BusinessMonth"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "MoneyTransferDay_businessMonthId_date_idx" ON "MoneyTransferDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyTransferDay_businessMonthId_date_key" ON "MoneyTransferDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "RechargeDay_businessMonthId_date_idx" ON "RechargeDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeDay_businessMonthId_date_key" ON "RechargeDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "RepairDay_businessMonthId_date_idx" ON "RepairDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RepairDay_businessMonthId_date_key" ON "RepairDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "MobileAccessoryDay_businessMonthId_date_idx" ON "MobileAccessoryDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MobileAccessoryDay_businessMonthId_date_key" ON "MobileAccessoryDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "ExtraIncomeEntry_businessMonthId_date_idx" ON "ExtraIncomeEntry"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "ShopExpenseDay_businessMonthId_date_idx" ON "ShopExpenseDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShopExpenseDay_businessMonthId_date_key" ON "ShopExpenseDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "DamageDay_businessMonthId_date_idx" ON "DamageDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DamageDay_businessMonthId_date_key" ON "DamageDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "PartyLedgerEntry_businessMonthId_date_idx" ON "PartyLedgerEntry"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "PartyLedgerEntry_businessMonthId_partyName_idx" ON "PartyLedgerEntry"("businessMonthId", "partyName");

-- CreateIndex
CREATE INDEX "UdhharDay_businessMonthId_date_idx" ON "UdhharDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UdhharDay_businessMonthId_date_key" ON "UdhharDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "BankBalanceDay_businessMonthId_date_idx" ON "BankBalanceDay"("businessMonthId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BankBalanceDay_businessMonthId_date_key" ON "BankBalanceDay"("businessMonthId", "date");

-- CreateIndex
CREATE INDEX "Withdrawal_businessMonthId_date_idx" ON "Withdrawal"("businessMonthId", "date");

-- AddForeignKey
ALTER TABLE "BusinessMonth" ADD CONSTRAINT "BusinessMonth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransferDay" ADD CONSTRAINT "MoneyTransferDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechargeDay" ADD CONSTRAINT "RechargeDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairDay" ADD CONSTRAINT "RepairDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileAccessoryDay" ADD CONSTRAINT "MobileAccessoryDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraIncomeEntry" ADD CONSTRAINT "ExtraIncomeEntry_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopExpenseDay" ADD CONSTRAINT "ShopExpenseDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageDay" ADD CONSTRAINT "DamageDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyLedgerEntry" ADD CONSTRAINT "PartyLedgerEntry_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UdhharDay" ADD CONSTRAINT "UdhharDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBalanceDay" ADD CONSTRAINT "BankBalanceDay_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_businessMonthId_fkey" FOREIGN KEY ("businessMonthId") REFERENCES "BusinessMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE;
