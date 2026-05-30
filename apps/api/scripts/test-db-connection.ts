import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("FAILED: DATABASE_URL is not set");
    process.exit(1);
  }

  const masked = url.replace(/:([^:@/]+)@/, ":***@");
  console.log("DATABASE_URL:", masked);

  const prisma = new PrismaClient();
  try {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    console.log("SUCCESS: Database connection OK", result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FAILED:", message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
