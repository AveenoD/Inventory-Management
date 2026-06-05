import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { d, fmt } from "../lib/decimal.js";
import { resolveMonthForDate } from "../services/month-resolver.js";
import { getDashboard } from "../services/dashboard.service.js";

export const todayRouter = Router();
todayRouter.use(requireAuth);

function prevMonthYearMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

todayRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const dateStr =
      typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const month = await resolveMonthForDate(userId, date);
    const dayOfMonth = date.getUTCDate();
    const isFirstDayOfMonth = dayOfMonth === 1;

    const start7 = new Date(date);
    start7.setUTCDate(start7.getUTCDate() - 6);

    const prev = prevMonthYearMonth(month.year, month.month);

    const [
      sales,
      rechargeEntries,
      transferEntries,
      deliveredToday,
      pendingPickup,
      undeliveredAll,
      activeRepairs,
      lowStockItems,
      lowStockCount,
      salesAgg,
      stockAgg,
      productCount,
      prevMonthRecord,
      monthDashboard,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, date },
        orderBy: { createdAt: "desc" },
      }),
      prisma.rechargeEntry.findMany({
        where: { businessMonthId: month.id, date },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transferEntry.findMany({
        where: { businessMonthId: month.id, date },
        orderBy: { createdAt: "desc" },
      }),
      prisma.repairJob.findMany({
        where: {
          businessMonthId: month.id,
          status: "DELIVERED",
          deliveredAt: date,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.repairJob.findMany({
        where: {
          businessMonthId: month.id,
          status: "REPAIRED_PENDING_PICKUP",
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.repairJob.count({
        where: {
          status: "REPAIRED_PENDING_PICKUP",
          businessMonth: { userId },
        },
      }),
      prisma.repairJob.count({
        where: {
          businessMonthId: month.id,
          status: { in: ["RECEIVED", "IN_PROGRESS", "REPAIRED_PENDING_PICKUP"] },
        },
      }),
      prisma.$queryRaw<Array<{ id: string; name: string; stockQty: number; minStock: number }>>`
        SELECT "id", "name", "stockQty", "minStock"
        FROM "Product"
        WHERE "userId" = ${userId}
          AND "isActive" = true
          AND "stockQty" <= "minStock"
        ORDER BY ("stockQty" - "minStock") ASC, "name" ASC
        LIMIT 5
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Product"
        WHERE "userId" = ${userId}
          AND "isActive" = true
          AND "stockQty" <= "minStock"
      `.then((rows) => Number(rows[0]?.count ?? 0)),
      prisma.sale.groupBy({
        by: ["date"],
        where: { userId, date: { gte: start7, lte: date } },
        _sum: { total: true, totalCost: true },
      }),
      prisma.$queryRaw<[{ value: string | null }]>`
        SELECT COALESCE(SUM("buyPrice" * "stockQty"), 0)::text AS value
        FROM "Product"
        WHERE "userId" = ${userId} AND "isActive" = true
      `,
      prisma.product.count({ where: { userId, isActive: true } }),
      prisma.businessMonth.findUnique({
        where: {
          userId_year_month: { userId, year: prev.year, month: prev.month },
        },
      }),
      getDashboard(month.id),
    ]);

    const salesTotal = sales.reduce((a, s) => a.plus(d(s.total)), d(0));
    const salesProfit = sales.reduce((a, s) => a.plus(d(s.total).minus(d(s.totalCost))), d(0));
    const rechargeTotal = rechargeEntries.reduce((a, e) => a.plus(d(e.amount)), d(0));
    const transferTotal = transferEntries.reduce((a, e) => a.plus(d(e.amount)), d(0));
    const repairProfit = deliveredToday.reduce((a, j) => a.plus(d(j.profit)), d(0));
    const repairPendingBalance = pendingPickup.reduce((a, j) => a.plus(d(j.salePrice)), d(0));
    const todayTotalProfit = salesProfit
      .plus(rechargeTotal)
      .plus(transferTotal)
      .plus(repairProfit);

    const salesByDate = new Map(
      salesAgg.map((g) => [
        g.date.toISOString().slice(0, 10),
        {
          total: d(g._sum.total ?? 0),
          profit: d(g._sum.total ?? 0).minus(d(g._sum.totalCost ?? 0)),
        },
      ]),
    );
    const salesLast7Days = Array.from({ length: 7 }).map((_, i) => {
      const dt = new Date(start7);
      dt.setUTCDate(start7.getUTCDate() + i);
      const key = dt.toISOString().slice(0, 10);
      const v = salesByDate.get(key) ?? { total: d(0), profit: d(0) };
      return { date: key, total: fmt(v.total), profit: fmt(v.profit) };
    });

    const recentActivity = [
      ...sales.slice(0, 6).map((s) => ({
        at: s.createdAt.toISOString(),
        type: "SALE" as const,
        title: "Sale completed",
        subtitle: s.customerName ? `Customer: ${s.customerName}` : undefined,
        amount: fmt(d(s.total)),
      })),
      ...rechargeEntries.slice(0, 6).map((e) => ({
        at: e.createdAt.toISOString(),
        type: "RECHARGE" as const,
        title: `Recharge ${e.operator}`,
        subtitle: e.note ?? undefined,
        amount: fmt(d(e.amount)),
      })),
      ...transferEntries.slice(0, 6).map((e) => ({
        at: e.createdAt.toISOString(),
        type: "TRANSFER" as const,
        title: `Money transfer ${e.serviceKey}`,
        subtitle: e.note ?? undefined,
        amount: fmt(d(e.amount)),
      })),
      ...deliveredToday.slice(0, 6).map((j) => ({
        at: j.updatedAt.toISOString(),
        type: "REPAIR" as const,
        title: "Repair delivered",
        subtitle: j.device ? `${j.device}` : undefined,
        amount: fmt(d(j.salePrice)),
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 10);

    let suggestedOpeningBalance: string | null = null;
    if (isFirstDayOfMonth && prevMonthRecord) {
      const prevDash = await getDashboard(prevMonthRecord.id);
      suggestedOpeningBalance = prevDash.paymentSummary.cashPortalBalance;
    }

    const openingBalance = fmt(d(month.openingBalance));
    const openingIsUnset = d(month.openingBalance).isZero();

    res.json({
      date: dateStr,
      monthId: month.id,
      year: month.year,
      month: month.month,
      salesTotal: fmt(salesTotal),
      salesProfit: fmt(salesProfit),
      salesCount: sales.length,
      rechargeTotal: fmt(rechargeTotal),
      transferTotal: fmt(transferTotal),
      activeRepairs,
      repairDelivered: deliveredToday.length,
      repairProfit: fmt(repairProfit),
      repairPendingCount: pendingPickup.length,
      repairPendingBalance: fmt(repairPendingBalance),
      repairUndeliveredCount: undeliveredAll,
      lowStockCount,
      lowStockItems,
      salesLast7Days,
      recentActivity,
      openingBalance,
      remainingBalance: monthDashboard.paymentSummary.cashPortalBalance,
      monthSalesTotal: monthDashboard.gross.mobileSale,
      monthRechargeTotal: monthDashboard.gross.rechargeTotal,
      monthRechargeTransferTotal: monthDashboard.serviceWise.rechargeTransferProfit,
      monthRepairProfit: monthDashboard.serviceWise.repairProfit,
      monthNetProfit: monthDashboard.netProfit,
      todayTotalProfit: fmt(todayTotalProfit),
      stockValue: fmt(d(stockAgg[0]?.value ?? 0)),
      productCount,
      isFirstDayOfMonth,
      suggestedOpeningBalance,
      showOpeningBalancePrompt: isFirstDayOfMonth && openingIsUnset,
    });
  } catch (e) {
    next(e);
  }
});
