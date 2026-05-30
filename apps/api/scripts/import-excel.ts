/**
 * One-off import of May 2026 Excel data.
 * Usage: npx tsx scripts/import-excel.ts path/to/file.xlsx
 * Requires DATABASE_URL, seeded user, and existing month 2026-05.
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import path from "path";

const prisma = new PrismaClient();

function parseExcelDate(v: unknown, year = 2026): string {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v);
  const m = s.match(/(\d+)-(\w+)-(\d+)/i);
  if (m) {
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    const mo = months[m[2].slice(0, 3).toLowerCase()] ?? 5;
    const y = 2000 + parseInt(m[3], 10);
    return `${y}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return `${year}-05-01`;
}

async function main() {
  const file = process.argv[2] ?? path.join(process.cwd(), "../../SK MOBILE SHOP MAY (Autosaved).xlsx");
  const wb = XLSX.readFile(file);
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("Run db:seed first");

  const month = await prisma.businessMonth.upsert({
    where: { userId_year_month: { userId: user.id, year: 2026, month: 5 } },
    create: { userId: user.id, year: 2026, month: 5, openingBalance: 910000 },
    update: {},
  });

  console.log("Importing into month", month.id);

  const mt = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Sheet2, { header: 1, defval: 0 });
  // Manual import via API recommended; this script validates file is readable
  console.log("Sheets:", wb.SheetNames);
  console.log("Month ready. Use API bulk endpoints or extend this script for full row import.");
}

main().finally(() => prisma.$disconnect());
