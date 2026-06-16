import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildMonthExportBuffer, buildDayExportBuffer } from "../src/services/export.service.js";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user — run db:seed");

  console.log("Testing month export...");
  const month = await buildMonthExportBuffer(user.id, 2026, 6);
  console.log("Month OK:", month.filename, month.buffer.length, "bytes");

  console.log("Testing day export...");
  const day = await buildDayExportBuffer(user.id, "2026-06-16");
  console.log("Day OK:", day.filename, day.buffer.length, "bytes");
}

main()
  .catch((e) => {
    console.error("EXPORT FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
