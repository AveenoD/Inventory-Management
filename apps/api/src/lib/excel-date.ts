import * as XLSX from "xlsx";

export function parseExcelDate(v: unknown, year = 2026): string {
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const s = String(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
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
  return `${year}-${String(5).padStart(2, "0")}-01`;
}

export function dateInMonth(dateStr: string, year: number, month: number): boolean {
  const [y, m] = dateStr.split("-").map(Number);
  return y === year && m === month;
}
