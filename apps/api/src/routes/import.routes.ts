import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { d, fmt } from "../lib/decimal.js";
import { getDashboard } from "../services/dashboard.service.js";
import { moneyTransferTotal, rechargeTotal } from "../services/calculations.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const importRouter = Router();
importRouter.use(requireAuth);

const EXCEL_GOLDEN = {
  totalIncome: "127352.03",
  netProfit: "925633.03",
};

function parseExcelDate(v: unknown, year = 2026): string {
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
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

importRouter.post("/excel", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const year = parseInt(String(req.body.year ?? "2026"), 10);
    const month = parseInt(String(req.body.month ?? "5"), 10);

    const businessMonth = await prisma.businessMonth.upsert({
      where: {
        userId_year_month: { userId: req.user!.userId, year, month },
      },
      create: {
        userId: req.user!.userId,
        year,
        month,
        openingBalance: 910000,
      },
      update: {},
    });

    const mid = businessMonth.id;
    let imported = { moneyTransferDays: 0, rechargeDays: 0, repairDays: 0, mobileDays: 0 };

    // Sheet2 — money transfer daily grid (rows from row 2)
    const sheet2 = wb.Sheets.Sheet2;
    if (sheet2) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet2, { header: 1, defval: 0 }) as unknown[][];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.[0]) continue;
        const date = parseExcelDate(row[0], year);
        const data = {
          dmt99Dmt: Number(row[1] ?? 0),
          dmt99Aeps: Number(row[2] ?? 0),
          dmt99Nepal: Number(row[3] ?? 0),
          dmt99BillPay: Number(row[4] ?? 0),
          dmt99Qr: Number(row[5] ?? 0),
          dmt86Dmt: Number(row[6] ?? 0),
          dmt86Aeps: Number(row[7] ?? 0),
          dmt86Credit: Number(row[8] ?? 0),
          dmt86BillPay: Number(row[9] ?? 0),
          dmt86Wallet: Number(row[10] ?? 0),
          dmt86Qr: Number(row[11] ?? 0),
          dmt86Nepal: Number(row[12] ?? 0),
          imeAeps: Number(row[13] ?? 0),
          imeNepal: Number(row[14] ?? 0),
        };
        const total = moneyTransferTotal(data);
        await prisma.moneyTransferDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: mid,
              date: new Date(`${date}T00:00:00.000Z`),
            },
          },
          create: {
            businessMonthId: mid,
            date: new Date(`${date}T00:00:00.000Z`),
            ...data,
            total,
          },
          update: { ...data, total },
        });
        imported.moneyTransferDays++;
      }
    }

    // Sheet3 — recharge (if present)
    const sheet3 = wb.Sheets.Sheet3 ?? wb.Sheets["Recharge"];
    if (sheet3) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet3, { header: 1, defval: 0 }) as unknown[][];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.[0]) continue;
        const date = parseExcelDate(row[0], year);
        const data = {
          airtelSaleProfit: Number(row[1] ?? 0),
          airtelChillar: Number(row[2] ?? 0),
          airtelAct: Number(row[3] ?? 0),
          airtelMnp: Number(row[4] ?? 0),
          jioSaleProfit: Number(row[5] ?? 0),
          jioChillar: Number(row[6] ?? 0),
          jioAct: Number(row[7] ?? 0),
          jioMnp: Number(row[8] ?? 0),
          viSaleProfit: Number(row[9] ?? 0),
          viChillar: Number(row[10] ?? 0),
          viAct: Number(row[11] ?? 0),
          viMnp: Number(row[12] ?? 0),
          bsnlSaleProfit: Number(row[13] ?? 0),
          bsnlChillar: Number(row[14] ?? 0),
          bsnlAct: Number(row[15] ?? 0),
          bsnlMnp: Number(row[16] ?? 0),
          allInOneSaleProfit: Number(row[17] ?? 0),
          allInOneChillar: Number(row[18] ?? 0),
        };
        const total = rechargeTotal(data);
        await prisma.rechargeDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: mid,
              date: new Date(`${date}T00:00:00.000Z`),
            },
          },
          create: {
            businessMonthId: mid,
            date: new Date(`${date}T00:00:00.000Z`),
            ...data,
            total,
          },
          update: { ...data, total },
        });
        imported.rechargeDays++;
      }
    }

    const dashboard = await getDashboard(mid);
    const incomeOk =
      Math.abs(parseFloat(dashboard.totalIncome) - parseFloat(EXCEL_GOLDEN.totalIncome)) < 1;
    const profitOk =
      Math.abs(parseFloat(dashboard.netProfit) - parseFloat(EXCEL_GOLDEN.netProfit)) < 1;

    res.json({
      sheets: wb.SheetNames,
      monthId: mid,
      imported,
      validation: {
        totalIncome: dashboard.totalIncome,
        expectedIncome: EXCEL_GOLDEN.totalIncome,
        incomeMatch: incomeOk,
        netProfit: dashboard.netProfit,
        expectedNetProfit: EXCEL_GOLDEN.netProfit,
        profitMatch: profitOk,
      },
    });
  } catch (e) {
    next(e);
  }
});
