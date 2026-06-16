import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import {
  addGridSheet,
  addKvBlock,
  addReportTitle,
  fillCell,
  workbookToBuffer,
  XL,
} from "../lib/excel-style.js";
import { getDashboard } from "./dashboard.service.js";
import { d } from "../lib/decimal.js";
import { resolveMonthForDate } from "./month-resolver.js";

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MT_HEADERS = [
  "Date",
  "DMT99 DMT", "DMT99 AEPS", "DMT99 Nepal", "DMT99 Bill Pay", "DMT99 QR",
  "DMT86 DMT", "DMT86 AEPS", "DMT86 Credit", "DMT86 Bill Pay", "DMT86 Wallet",
  "DMT86 QR", "DMT86 Nepal", "IME AEPS", "IME Nepal", "Total",
];

const RC_HEADERS = [
  "Date",
  "Airtel Sale/Profit", "Airtel Chillar", "Airtel ACT", "Airtel MNP",
  "Jio Sale/Profit", "Jio Chillar", "Jio ACT", "Jio MNP",
  "Vi Sale/Profit", "Vi Chillar", "Vi ACT", "Vi MNP",
  "BSNL Sale/Profit", "BSNL Chillar", "BSNL ACT", "BSNL MNP",
  "All-in-One Sale/Profit", "All-in-One Chillar", "Total",
];

function moneyTransferRow(row: {
  date: Date;
  dmt99Dmt: unknown; dmt99Aeps: unknown; dmt99Nepal: unknown; dmt99BillPay: unknown; dmt99Qr: unknown;
  dmt86Dmt: unknown; dmt86Aeps: unknown; dmt86Credit: unknown; dmt86BillPay: unknown; dmt86Wallet: unknown;
  dmt86Qr: unknown; dmt86Nepal: unknown; imeAeps: unknown; imeNepal: unknown; total: unknown;
}): (string | number)[] {
  return [
    formatDate(row.date),
    toNum(row.dmt99Dmt), toNum(row.dmt99Aeps), toNum(row.dmt99Nepal), toNum(row.dmt99BillPay), toNum(row.dmt99Qr),
    toNum(row.dmt86Dmt), toNum(row.dmt86Aeps), toNum(row.dmt86Credit), toNum(row.dmt86BillPay), toNum(row.dmt86Wallet),
    toNum(row.dmt86Qr), toNum(row.dmt86Nepal), toNum(row.imeAeps), toNum(row.imeNepal), toNum(row.total),
  ];
}

function rechargeRow(row: {
  date: Date;
  airtelSaleProfit: unknown; airtelChillar: unknown; airtelAct: unknown; airtelMnp: unknown;
  jioSaleProfit: unknown; jioChillar: unknown; jioAct: unknown; jioMnp: unknown;
  viSaleProfit: unknown; viChillar: unknown; viAct: unknown; viMnp: unknown;
  bsnlSaleProfit: unknown; bsnlChillar: unknown; bsnlAct: unknown; bsnlMnp: unknown;
  allInOneSaleProfit: unknown; allInOneChillar: unknown; total: unknown;
}): (string | number)[] {
  return [
    formatDate(row.date),
    toNum(row.airtelSaleProfit), toNum(row.airtelChillar), toNum(row.airtelAct), toNum(row.airtelMnp),
    toNum(row.jioSaleProfit), toNum(row.jioChillar), toNum(row.jioAct), toNum(row.jioMnp),
    toNum(row.viSaleProfit), toNum(row.viChillar), toNum(row.viAct), toNum(row.viMnp),
    toNum(row.bsnlSaleProfit), toNum(row.bsnlChillar), toNum(row.bsnlAct), toNum(row.bsnlMnp),
    toNum(row.allInOneSaleProfit), toNum(row.allInOneChillar), toNum(row.total),
  ];
}

async function fetchInventory(userId: string) {
  return prisma.product.findMany({
    where: { userId, isActive: true },
    include: { category: true },
    orderBy: { name: "asc" },
  });
}

function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK Mobile Shop";
  wb.created = new Date();
  return wb;
}

function buildSummarySheet(
  sheet: ExcelJS.Worksheet,
  reportTitle: string,
  periodLabel: string,
  dashboard: Awaited<ReturnType<typeof getDashboard>>,
  stockStats: { productCount: number; totalQty: number; stockValue: number },
) {
  const LEFT = 1;
  const RIGHT = 4;
  const TOTAL_COLS = 5;

  addReportTitle(sheet, reportTitle, `Period: ${periodLabel}`, TOTAL_COLS);
  sheet.mergeCells(3, 1, 3, TOTAL_COLS);
  const metaCell = sheet.getCell(3, 1);
  metaCell.value = `Generated on ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}`;
  fillCell(metaCell, XL.section, { color: XL.muted, hAlign: "left" });
  metaCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(3).height = 20;

  const startRow = 5;

  const finEnd = addKvBlock(sheet, startRow, LEFT, "Financial Summary", [
    { label: "Opening Balance", value: toNum(dashboard.openingBalance) },
    { label: "Total Income", value: toNum(dashboard.totalIncome), highlight: true },
    { label: "Recharge + Transfer", value: toNum(dashboard.serviceWise.rechargeTransferProfit) },
    { label: "Repair Profit", value: toNum(dashboard.serviceWise.repairProfit) },
    { label: "Mobile & Accessories", value: toNum(dashboard.serviceWise.mobileProfit) },
    { label: "Extra Income", value: toNum(dashboard.serviceWise.extraIncome) },
    { label: "Total Expenses", value: toNum(dashboard.totalExpense) },
    { label: "Withdrawals", value: toNum(dashboard.totalWithdrawal) },
    { label: "Damage", value: toNum(dashboard.totalDamage) },
    { label: "Net Profit", value: toNum(dashboard.netProfit), isTotal: true },
  ]);

  const grossEnd = addKvBlock(sheet, startRow, RIGHT, "Gross Sales", [
    { label: "Money Transfer Total", value: toNum(dashboard.gross.moneyTransferTotal) },
    { label: "Recharge Total", value: toNum(dashboard.gross.rechargeTotal) },
    { label: "Repair Sale", value: toNum(dashboard.gross.repairSale) },
    { label: "Mobile Sale", value: toNum(dashboard.gross.mobileSale) },
  ]);

  const row2 = Math.max(finEnd, grossEnd) + 1;

  const balEnd = addKvBlock(sheet, row2, LEFT, "Balance Summary", [
    { label: "Cash / Portal Balance", value: toNum(dashboard.paymentSummary.cashPortalBalance) },
    { label: "Bank Balance", value: toNum(dashboard.paymentSummary.bankBalance) },
    { label: "Udhhar (Net)", value: toNum(dashboard.paymentSummary.udhharNet) },
    { label: "Party Outstanding", value: toNum(dashboard.paymentSummary.partyOutstanding) },
    { label: "Grand Total Balance", value: toNum(dashboard.paymentSummary.grandTotal), isTotal: true },
  ]);

  addKvBlock(sheet, row2, RIGHT, "Inventory Summary", [
    { label: "Total Products", value: stockStats.productCount, format: "integer" },
    { label: "Total Stock Quantity", value: stockStats.totalQty, format: "integer" },
    { label: "Total Stock Value", value: stockStats.stockValue, isTotal: true },
  ]);

  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 3;
  sheet.getColumn(4).width = 28;
  sheet.getColumn(5).width = 16;
  sheet.views = [{ showGridLines: false, activeCell: "A1" }];
}

function buildDaySummarySheet(
  sheet: ExcelJS.Worksheet,
  dateStr: string,
  dayIncome: number,
  dashboard: Awaited<ReturnType<typeof getDashboard>>,
  stockStats: { productCount: number; totalQty: number; stockValue: number },
  day: {
    moneyTransfer: number;
    recharge: number;
    repair: number;
    mobile: number;
    expenses: number;
  },
) {
  const LEFT = 1;
  const RIGHT = 4;
  const TOTAL_COLS = 5;

  addReportTitle(sheet, "SK Mobile Shop — Daily Report", `Date: ${dateStr}`, TOTAL_COLS);
  sheet.mergeCells(3, 1, 3, TOTAL_COLS);
  const metaCell = sheet.getCell(3, 1);
  metaCell.value = `Generated on ${new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}`;
  fillCell(metaCell, XL.section, { color: XL.muted, hAlign: "left" });
  metaCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(3).height = 20;

  const startRow = 5;

  const dailyEnd = addKvBlock(sheet, startRow, LEFT, "Daily Totals", [
    { label: "Money Transfer", value: day.moneyTransfer },
    { label: "Recharge", value: day.recharge },
    { label: "Repair Profit", value: day.repair },
    { label: "Mobile Profit", value: day.mobile },
    { label: "Shop Expenses", value: day.expenses },
    { label: "Day Income (services)", value: dayIncome, isTotal: true },
  ]);

  const monthEnd = addKvBlock(sheet, startRow, RIGHT, "Month Context", [
    { label: "Month Total Income", value: toNum(dashboard.totalIncome) },
    { label: "Month Net Profit", value: toNum(dashboard.netProfit), isTotal: true },
  ]);

  const row2 = Math.max(dailyEnd, monthEnd) + 1;

  addKvBlock(sheet, row2, LEFT, "Inventory (current stock)", [
    { label: "Total Products", value: stockStats.productCount, format: "integer" },
    { label: "Total Stock Quantity", value: stockStats.totalQty, format: "integer" },
    { label: "Total Stock Value", value: stockStats.stockValue, isTotal: true },
  ]);

  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 3;
  sheet.getColumn(4).width = 28;
  sheet.getColumn(5).width = 16;
  sheet.views = [{ showGridLines: false, activeCell: "A1" }];
}

function buildInventorySheet(
  wb: ExcelJS.Workbook,
  products: Awaited<ReturnType<typeof fetchInventory>>,
) {
  const headers = ["Product", "Category", "Kind", "Buy Price (₹)", "Sell Price (₹)", "Stock Qty", "Stock Value (₹)"];
  const rows: (string | number)[][] = products.map((p) => {
    const buy = toNum(p.buyPrice);
    return [p.name, p.category?.name ?? "", p.kind, buy, toNum(p.sellPrice), p.stockQty, buy * p.stockQty];
  });

  const totalQty = products.reduce((a, p) => a + p.stockQty, 0);
  const totalValue = products.reduce((a, p) => a + toNum(p.buyPrice) * p.stockQty, 0);
  rows.push(["TOTAL", "", "", "", "", totalQty, totalValue]);

  const sheet = wb.addWorksheet("Inventory");
  addGridSheet(sheet, "Inventory Stock", headers, rows, 4);

  if (products.length > 0) {
    const totalRow = sheet.rowCount;
    for (let c = 1; c <= headers.length; c++) {
      const cell = sheet.getCell(totalRow, c);
      fillCell(cell, XL.totalBg, { bold: true });
    }
  }
}

function appendDailySheets(
  wb: ExcelJS.Workbook,
  data: {
    moneyTransferDays: Awaited<ReturnType<typeof prisma.moneyTransferDay.findMany>>;
    rechargeDays: Awaited<ReturnType<typeof prisma.rechargeDay.findMany>>;
    repairDays: Awaited<ReturnType<typeof prisma.repairDay.findMany>>;
    mobileDays: Awaited<ReturnType<typeof prisma.mobileAccessoryDay.findMany>>;
    shopExpenseDays: Awaited<ReturnType<typeof prisma.shopExpenseDay.findMany>>;
  },
) {
  addGridSheet(
    wb.addWorksheet("Money Transfer"),
    "Money Transfer — Daily",
    MT_HEADERS,
    data.moneyTransferDays.map(moneyTransferRow),
    2,
  );
  addGridSheet(
    wb.addWorksheet("Recharge"),
    "Recharge — Daily",
    RC_HEADERS,
    data.rechargeDays.map(rechargeRow),
    2,
  );
  addGridSheet(
    wb.addWorksheet("Repair"),
    "Repair — Daily",
    ["Date", "Jobs", "Sale (₹)", "Cost (₹)", "Profit (₹)"],
    data.repairDays.map((r) => [
      formatDate(r.date), r.jobCount, toNum(r.sale), toNum(r.cost), toNum(r.profit),
    ]),
    3,
  );
  addGridSheet(
    wb.addWorksheet("Mobile"),
    "Mobile & Accessories — Daily",
    ["Date", "Sale (₹)", "Cost (₹)", "Profit (₹)"],
    data.mobileDays.map((m) => [
      formatDate(m.date), toNum(m.sale), toNum(m.cost), toNum(m.profit),
    ]),
    2,
  );
  addGridSheet(
    wb.addWorksheet("Expenses"),
    "Shop Expenses — Daily",
    ["Date", "Salary (₹)", "Tea (₹)", "Shop Expense (₹)", "Total (₹)"],
    data.shopExpenseDays.map((e) => [
      formatDate(e.date),
      toNum(e.salaryAmount),
      toNum(e.teaAmount),
      toNum(e.shopExpAmount),
      toNum(e.total),
    ]),
    2,
  );
}

export async function buildMonthExportBuffer(userId: string, year: number, month: number) {
  const businessMonth = await prisma.businessMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
  });
  if (!businessMonth) {
    throw new Error(`No data found for ${year}-${String(month).padStart(2, "0")}. Create the month first.`);
  }

  const mid = businessMonth.id;
  const dashboard = await getDashboard(mid);
  const [moneyTransferDays, rechargeDays, repairDays, mobileDays, shopExpenseDays, products] =
    await Promise.all([
      prisma.moneyTransferDay.findMany({ where: { businessMonthId: mid }, orderBy: { date: "asc" } }),
      prisma.rechargeDay.findMany({ where: { businessMonthId: mid }, orderBy: { date: "asc" } }),
      prisma.repairDay.findMany({ where: { businessMonthId: mid }, orderBy: { date: "asc" } }),
      prisma.mobileAccessoryDay.findMany({ where: { businessMonthId: mid }, orderBy: { date: "asc" } }),
      prisma.shopExpenseDay.findMany({ where: { businessMonthId: mid }, orderBy: { date: "asc" } }),
      fetchInventory(userId),
    ]);

  const stockStats = {
    productCount: products.length,
    totalQty: products.reduce((a, p) => a + p.stockQty, 0),
    stockValue: products.reduce((a, p) => a + toNum(p.buyPrice) * p.stockQty, 0),
  };

  const wb = newWorkbook();
  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;
  const summary = wb.addWorksheet("Summary");
  buildSummarySheet(summary, "SK Mobile Shop — Monthly Report", periodLabel, dashboard, stockStats);

  appendDailySheets(wb, { moneyTransferDays, rechargeDays, repairDays, mobileDays, shopExpenseDays });
  buildInventorySheet(wb, products);

  return {
    buffer: await workbookToBuffer(wb),
    filename: `sk-mobile-${year}-${String(month).padStart(2, "0")}.xlsx`,
  };
}

export async function buildDayExportBuffer(userId: string, dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const businessMonth = await resolveMonthForDate(userId, date);
  const mid = businessMonth.id;

  const [
    dashboard,
    moneyTransfer,
    recharge,
    repair,
    mobile,
    shopExpense,
    products,
    sales,
    rechargeEntries,
    transferEntries,
    repairJobs,
  ] = await Promise.all([
    getDashboard(mid),
    prisma.moneyTransferDay.findUnique({
      where: { businessMonthId_date: { businessMonthId: mid, date } },
    }),
    prisma.rechargeDay.findUnique({
      where: { businessMonthId_date: { businessMonthId: mid, date } },
    }),
    prisma.repairDay.findUnique({
      where: { businessMonthId_date: { businessMonthId: mid, date } },
    }),
    prisma.mobileAccessoryDay.findUnique({
      where: { businessMonthId_date: { businessMonthId: mid, date } },
    }),
    prisma.shopExpenseDay.findUnique({
      where: { businessMonthId_date: { businessMonthId: mid, date } },
    }),
    fetchInventory(userId),
    prisma.sale.findMany({
      where: { userId, date },
      include: { lines: { include: { product: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rechargeEntry.findMany({
      where: { businessMonthId: mid, date, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transferEntry.findMany({
      where: { businessMonthId: mid, date },
      orderBy: { createdAt: "asc" },
    }),
    prisma.repairJob.findMany({
      where: { businessMonthId: mid, status: "DELIVERED", deliveredAt: date },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const dayIncome =
    toNum(moneyTransfer?.total) +
    toNum(recharge?.total) +
    toNum(repair?.profit) +
    toNum(mobile?.profit);

  const stockStats = {
    productCount: products.length,
    totalQty: products.reduce((a, p) => a + p.stockQty, 0),
    stockValue: products.reduce((a, p) => a + toNum(p.buyPrice) * p.stockQty, 0),
  };

  const wb = newWorkbook();
  const summary = wb.addWorksheet("Summary");
  buildDaySummarySheet(
    summary,
    dateStr,
    dayIncome,
    dashboard,
    stockStats,
    {
      moneyTransfer: toNum(moneyTransfer?.total),
      recharge: toNum(recharge?.total),
      repair: toNum(repair?.profit),
      mobile: toNum(mobile?.profit),
      expenses: toNum(shopExpense?.total),
    },
  );

  appendDailySheets(wb, {
    moneyTransferDays: moneyTransfer ? [moneyTransfer] : [],
    rechargeDays: recharge ? [recharge] : [],
    repairDays: repair ? [repair] : [],
    mobileDays: mobile ? [mobile] : [],
    shopExpenseDays: shopExpense ? [shopExpense] : [],
  });

  addGridSheet(
    wb.addWorksheet("Sales"),
    "Sales — Detail",
    ["Time", "Customer", "Payment", "Total (₹)", "Cost (₹)", "Profit (₹)"],
    sales.map((s) => [
      s.createdAt.toLocaleString("en-IN"),
      s.customerName ?? "",
      s.paymentMethod,
      toNum(s.total),
      toNum(s.totalCost),
      toNum(d(s.total).minus(d(s.totalCost))),
    ]),
    4,
  );

  addGridSheet(
    wb.addWorksheet("Recharge Entries"),
    "Recharge Entries",
    ["Time", "Operator", "Type", "Note", "Amount (₹)"],
    rechargeEntries.map((e) => [
      e.createdAt.toLocaleString("en-IN"),
      e.operator,
      e.entryType,
      e.note ?? "",
      toNum(e.amount),
    ]),
    5,
  );

  addGridSheet(
    wb.addWorksheet("Transfer Entries"),
    "Money Transfer Entries",
    ["Time", "Service", "Note", "Amount (₹)"],
    transferEntries.map((e) => [
      e.createdAt.toLocaleString("en-IN"),
      e.serviceKey,
      e.note ?? "",
      toNum(e.amount),
    ]),
    4,
  );

  addGridSheet(
    wb.addWorksheet("Repair Jobs"),
    "Repair Jobs Delivered",
    ["Device", "Customer", "Sale (₹)", "Parts (₹)", "Labour (₹)", "Profit (₹)", "Status"],
    repairJobs.map((j) => [
      j.device ?? "",
      j.customerName ?? "",
      toNum(j.salePrice),
      toNum(j.partsCost),
      toNum(j.labourCost),
      toNum(j.profit),
      j.status,
    ]),
    3,
  );

  buildInventorySheet(wb, products);

  return {
    buffer: await workbookToBuffer(wb),
    filename: `sk-mobile-day-${dateStr}.xlsx`,
  };
}

/** Import template stays plain xlsx (data-only) for compatibility with import parser */
export function buildImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const sheetFromRows = (rows: unknown[][]) => XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheetFromRows([MT_HEADERS]), "Money Transfer");
  XLSX.utils.book_append_sheet(wb, sheetFromRows([RC_HEADERS]), "Recharge");
  XLSX.utils.book_append_sheet(wb, sheetFromRows([["Date", "Jobs", "Sale", "Cost"]]), "Repair");
  XLSX.utils.book_append_sheet(wb, sheetFromRows([["Date", "Sale", "Cost"]]), "Mobile");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
