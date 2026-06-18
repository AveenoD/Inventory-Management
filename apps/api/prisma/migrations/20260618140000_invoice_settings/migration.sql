-- CreateTable
CREATE TABLE "InvoiceSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "logoDataUrl" TEXT,
    "warrantyText" TEXT,
    "nextInvoiceNo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InvoiceSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "invoiceNo" TEXT;
ALTER TABLE "Sale" ADD COLUMN "warrantyNote" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSettings_userId_key" ON "InvoiceSettings"("userId");
CREATE INDEX "InvoiceSettings_userId_idx" ON "InvoiceSettings"("userId");
CREATE INDEX "Sale_userId_invoiceNo_idx" ON "Sale"("userId", "invoiceNo");

-- AddForeignKey
ALTER TABLE "InvoiceSettings" ADD CONSTRAINT "InvoiceSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
