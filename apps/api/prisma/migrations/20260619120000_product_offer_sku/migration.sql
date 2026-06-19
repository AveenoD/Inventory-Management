-- AlterTable
ALTER TABLE "Product" ADD COLUMN "offerPrice" DECIMAL(14,2);

-- Backfill SKU for existing products (per-user sequence)
WITH numbered AS (
  SELECT
    id,
    "userId",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", id) AS rn
  FROM "Product"
  WHERE "sku" IS NULL
)
UPDATE "Product" p
SET "sku" = 'SK-' || LPAD(n.rn::text, 6, '0')
FROM numbered n
WHERE p.id = n.id;

-- CreateIndex
CREATE UNIQUE INDEX "Product_userId_sku_key" ON "Product"("userId", "sku");
