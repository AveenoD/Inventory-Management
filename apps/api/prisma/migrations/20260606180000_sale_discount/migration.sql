-- Store sale-level discount (subtracted from line subtotal)

ALTER TABLE "Sale" ADD COLUMN "discount" DECIMAL(14, 2) NOT NULL DEFAULT 0;
