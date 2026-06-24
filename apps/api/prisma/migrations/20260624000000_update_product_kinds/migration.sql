-- Alter column to TEXT to freely update values
ALTER TABLE "Product" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "kind" TYPE TEXT;

-- Update old rows to new mapped string values
UPDATE "Product" SET "kind" = 'ANDROID_MOBILE' WHERE "kind" = 'MOBILE';
UPDATE "Product" SET "kind" = 'MOBILE_ACCESSORY' WHERE "kind" IN ('SPEAKERS_SOUND', 'CHARGER_CABLE');

-- Create the new enum
CREATE TYPE "ProductKind_new" AS ENUM ('ANDROID_MOBILE', 'BASIC_MOBILE', 'MOBILE_ACCESSORY', 'REPAIR_PART');

-- Alter the column to use the new enum type
ALTER TABLE "Product" ALTER COLUMN "kind" TYPE "ProductKind_new" 
  USING ("kind"::text::"ProductKind_new");

-- Drop old enum and rename new one
DROP TYPE "ProductKind";
ALTER TYPE "ProductKind_new" RENAME TO "ProductKind";

-- Set the default back
ALTER TABLE "Product" ALTER COLUMN "kind" SET DEFAULT 'MOBILE_ACCESSORY';
