-- Phone model hierarchy for covers (Option B)

CREATE TABLE "PhoneModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhoneModel_userId_name_key" ON "PhoneModel"("userId", "name");
CREATE INDEX "PhoneModel_userId_idx" ON "PhoneModel"("userId");

ALTER TABLE "PhoneModel" ADD CONSTRAINT "PhoneModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoverType" ADD COLUMN "phoneModelId" TEXT;

DROP INDEX IF EXISTS "CoverType_userId_name_key";

CREATE UNIQUE INDEX "CoverType_userId_phoneModelId_name_key" ON "CoverType"("userId", "phoneModelId", "name");
CREATE INDEX "CoverType_phoneModelId_idx" ON "CoverType"("phoneModelId");

ALTER TABLE "CoverType" ADD CONSTRAINT "CoverType_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "phoneModelId" TEXT;
ALTER TABLE "Product" ADD COLUMN "variantName" TEXT;

CREATE INDEX "Product_phoneModelId_idx" ON "Product"("phoneModelId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill phone models from existing accessory products
INSERT INTO "PhoneModel" ("id", "userId", "name", "createdAt")
SELECT
  'pm_' || substr(md5("userId" || ':' || trim("phoneModel")), 1, 24),
  "userId",
  trim("phoneModel"),
  CURRENT_TIMESTAMP
FROM "Product"
WHERE "phoneModel" IS NOT NULL
  AND trim("phoneModel") <> ''
  AND "kind" = 'MOBILE_ACCESSORY'
GROUP BY "userId", trim("phoneModel")
ON CONFLICT ("userId", "name") DO NOTHING;

UPDATE "Product" p
SET "phoneModelId" = pm."id"
FROM "PhoneModel" pm
WHERE p."userId" = pm."userId"
  AND trim(p."phoneModel") = pm."name"
  AND p."phoneModel" IS NOT NULL
  AND trim(p."phoneModel") <> '';

-- Scope existing cover types per phone model (one copy per model that uses them)
INSERT INTO "CoverType" ("id", "userId", "phoneModelId", "name", "createdAt")
SELECT
  'ct_' || substr(md5(ct."id" || ':' || pm."id"), 1, 24),
  ct."userId",
  pm."id",
  ct."name",
  CURRENT_TIMESTAMP
FROM "CoverType" ct
INNER JOIN "Product" p ON p."coverTypeId" = ct."id"
INNER JOIN "PhoneModel" pm ON pm."id" = p."phoneModelId"
WHERE ct."phoneModelId" IS NULL
  AND p."phoneModelId" IS NOT NULL
GROUP BY ct."id", ct."userId", ct."name", pm."id"
ON CONFLICT ("userId", "phoneModelId", "name") DO NOTHING;

UPDATE "Product" p
SET "coverTypeId" = scoped."id"
FROM "CoverType" legacy, "CoverType" scoped
WHERE p."coverTypeId" = legacy."id"
  AND legacy."phoneModelId" IS NULL
  AND p."phoneModelId" IS NOT NULL
  AND scoped."userId" = legacy."userId"
  AND scoped."name" = legacy."name"
  AND scoped."phoneModelId" = p."phoneModelId"
  AND scoped."phoneModelId" IS NOT NULL;
