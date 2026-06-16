import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import { dateInMonth, parseExcelDate } from "../lib/excel-date.js";
import { getDashboard } from "./dashboard.service.js";
import { moneyTransferTotal, rechargeTotal, profit } from "./calculations.js";

export type ImportPreview = {
  sheets: string[];
  counts: {
    moneyTransferDays: number;
    rechargeDays: number;
    repairDays: number;
    mobileDays: number;
  };
  warnings: string[];
  errors: string[];
};

export type ImportResult = ImportPreview & {
  monthId: string;
  dryRun: boolean;
  validation?: {
    totalIncome: string;
    netProfit: string;
    rechargeTransferProfit: string;
  };
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sheetRows(sheet: XLSX.WorkSheet | undefined): unknown[][] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: 0 }) as unknown[][];
}

function findSheet(wb: XLSX.WorkBook, names: string[]): XLSX.WorkSheet | undefined {
  for (const name of names) {
    if (wb.Sheets[name]) return wb.Sheets[name];
  }
  const lower = names.map((n) => n.toLowerCase());
  for (const sheetName of wb.SheetNames) {
    if (lower.includes(sheetName.toLowerCase())) return wb.Sheets[sheetName];
  }
  return undefined;
}

export async function importExcelWorkbook(
  buffer: Buffer,
  userId: string,
  year: number,
  month: number,
  dryRun = false,
): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const warnings: string[] = [];
  const errors: string[] = [];
  const counts = { moneyTransferDays: 0, rechargeDays: 0, repairDays: 0, mobileDays: 0 };

  const moneySheet = findSheet(wb, ["Sheet2", "Money Transfer"]);
  const rechargeSheet = findSheet(wb, ["Sheet3", "Recharge"]);
  const repairSheet = findSheet(wb, ["Repair"]);
  const mobileSheet = findSheet(wb, ["Mobile"]);

  if (!moneySheet && !rechargeSheet && !repairSheet && !mobileSheet) {
    errors.push("No recognised sheets found. Expected Money Transfer, Recharge, Repair, or Mobile.");
  }
  if (!moneySheet) warnings.push("Money Transfer sheet not found — skipping.");
  if (!rechargeSheet) warnings.push("Recharge sheet not found — skipping.");
  if (!repairSheet) warnings.push("Repair sheet not found — skipping.");
  if (!mobileSheet) warnings.push("Mobile sheet not found — skipping.");

  const parsed = {
    moneyTransfer: [] as Array<{ date: string; data: Record<string, number>; total: string }>,
    recharge: [] as Array<{ date: string; data: Record<string, number>; total: string }>,
    repair: [] as Array<{ date: string; jobCount: number; sale: number; cost: number; profitVal: string }>,
    mobile: [] as Array<{ date: string; sale: number; cost: number; profitVal: string }>,
  };

  if (moneySheet) {
    const rows = sheetRows(moneySheet);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.[0]) continue;
      const date = parseExcelDate(row[0], year);
      if (!dateInMonth(date, year, month)) {
        warnings.push(`Money Transfer row ${i + 1}: date ${date} is outside ${year}-${month}.`);
        continue;
      }
      const data = {
        dmt99Dmt: num(row[1]), dmt99Aeps: num(row[2]), dmt99Nepal: num(row[3]),
        dmt99BillPay: num(row[4]), dmt99Qr: num(row[5]), dmt86Dmt: num(row[6]),
        dmt86Aeps: num(row[7]), dmt86Credit: num(row[8]), dmt86BillPay: num(row[9]),
        dmt86Wallet: num(row[10]), dmt86Qr: num(row[11]), dmt86Nepal: num(row[12]),
        imeAeps: num(row[13]), imeNepal: num(row[14]),
      };
      parsed.moneyTransfer.push({ date, data, total: moneyTransferTotal(data) });
      counts.moneyTransferDays++;
    }
  }

  if (rechargeSheet) {
    const rows = sheetRows(rechargeSheet);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.[0]) continue;
      const date = parseExcelDate(row[0], year);
      if (!dateInMonth(date, year, month)) {
        warnings.push(`Recharge row ${i + 1}: date ${date} is outside ${year}-${month}.`);
        continue;
      }
      const data = {
        airtelSaleProfit: num(row[1]), airtelChillar: num(row[2]), airtelAct: num(row[3]), airtelMnp: num(row[4]),
        jioSaleProfit: num(row[5]), jioChillar: num(row[6]), jioAct: num(row[7]), jioMnp: num(row[8]),
        viSaleProfit: num(row[9]), viChillar: num(row[10]), viAct: num(row[11]), viMnp: num(row[12]),
        bsnlSaleProfit: num(row[13]), bsnlChillar: num(row[14]), bsnlAct: num(row[15]), bsnlMnp: num(row[16]),
        allInOneSaleProfit: num(row[17]), allInOneChillar: num(row[18]),
      };
      parsed.recharge.push({ date, data, total: rechargeTotal(data) });
      counts.rechargeDays++;
    }
  }

  if (repairSheet) {
    const rows = sheetRows(repairSheet);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.[0]) continue;
      const date = parseExcelDate(row[0], year);
      if (!dateInMonth(date, year, month)) {
        warnings.push(`Repair row ${i + 1}: date ${date} is outside ${year}-${month}.`);
        continue;
      }
      const sale = num(row[2]);
      const cost = num(row[3]);
      parsed.repair.push({
        date,
        jobCount: Math.max(0, Math.floor(num(row[1]))),
        sale,
        cost,
        profitVal: profit(sale, cost),
      });
      counts.repairDays++;
    }
  }

  if (mobileSheet) {
    const rows = sheetRows(mobileSheet);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.[0]) continue;
      const date = parseExcelDate(row[0], year);
      if (!dateInMonth(date, year, month)) {
        warnings.push(`Mobile row ${i + 1}: date ${date} is outside ${year}-${month}.`);
        continue;
      }
      const sale = num(row[1]);
      const cost = num(row[2]);
      parsed.mobile.push({
        date,
        sale,
        cost,
        profitVal: profit(sale, cost),
      });
      counts.mobileDays++;
    }
  }

  if (errors.length > 0) {
    return { sheets: wb.SheetNames, counts, warnings, errors, monthId: "", dryRun };
  }

  if (dryRun) {
    return { sheets: wb.SheetNames, counts, warnings, errors, monthId: "", dryRun: true };
  }

  const businessMonth = await prisma.businessMonth.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, year, month, openingBalance: 0 },
    update: {},
  });
  const mid = businessMonth.id;

  for (const entry of parsed.moneyTransfer) {
    await prisma.moneyTransferDay.upsert({
      where: { businessMonthId_date: { businessMonthId: mid, date: new Date(`${entry.date}T00:00:00.000Z`) } },
      create: { businessMonthId: mid, date: new Date(`${entry.date}T00:00:00.000Z`), ...entry.data, total: entry.total },
      update: { ...entry.data, total: entry.total },
    });
  }

  for (const entry of parsed.recharge) {
    await prisma.rechargeDay.upsert({
      where: { businessMonthId_date: { businessMonthId: mid, date: new Date(`${entry.date}T00:00:00.000Z`) } },
      create: { businessMonthId: mid, date: new Date(`${entry.date}T00:00:00.000Z`), ...entry.data, total: entry.total },
      update: { ...entry.data, total: entry.total },
    });
  }

  for (const entry of parsed.repair) {
    await prisma.repairDay.upsert({
      where: { businessMonthId_date: { businessMonthId: mid, date: new Date(`${entry.date}T00:00:00.000Z`) } },
      create: {
        businessMonthId: mid,
        date: new Date(`${entry.date}T00:00:00.000Z`),
        jobCount: entry.jobCount,
        sale: entry.sale,
        cost: entry.cost,
        profit: entry.profitVal,
      },
      update: {
        jobCount: entry.jobCount,
        sale: entry.sale,
        cost: entry.cost,
        profit: entry.profitVal,
      },
    });
  }

  for (const entry of parsed.mobile) {
    await prisma.mobileAccessoryDay.upsert({
      where: { businessMonthId_date: { businessMonthId: mid, date: new Date(`${entry.date}T00:00:00.000Z`) } },
      create: {
        businessMonthId: mid,
        date: new Date(`${entry.date}T00:00:00.000Z`),
        sale: entry.sale,
        cost: entry.cost,
        profit: entry.profitVal,
      },
      update: { sale: entry.sale, cost: entry.cost, profit: entry.profitVal },
    });
  }

  const dashboard = await getDashboard(mid);

  return {
    sheets: wb.SheetNames,
    monthId: mid,
    counts,
    warnings,
    errors,
    dryRun: false,
    validation: {
      totalIncome: dashboard.totalIncome,
      netProfit: dashboard.netProfit,
      rechargeTransferProfit: dashboard.serviceWise.rechargeTransferProfit,
    },
  };
}
