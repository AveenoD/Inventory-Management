import { Router } from "express";
import { poolBatch } from "../lib/pool-batch.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { d, fmt } from "../lib/decimal.js";
import { resolveMonthForDate } from "../services/month-resolver.js";
import { getDashboard } from "../services/dashboard.service.js";

export const todayRouter = Router();
todayRouter.use(requireAuth);

const POOL_CONCURRENCY = 3;

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

    const batch = await poolBatch(
      [
        () =>
          prisma.sale.aggregate({
            where: { userId, date },
            _sum: { total: true, totalCost: true },
            _count: { _all: true },
          }),
        () =>
          prisma.sale.findMany({
            where: { userId, date },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              createdAt: true,
              customerName: true,
              total: true,
            },
          }),
        () =>
          prisma.rechargeEntry.aggregate({
            where: { businessMonthId: month.id, date, isActive: true },
            _sum: { amount: true },
            _count: { _all: true },
          }),
        () =>
          prisma.rechargeEntry.findMany({
            where: { businessMonthId: month.id, date, isActive: true },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              createdAt: true,
              operator: true,
              note: true,
              amount: true,
            },
          }),
        () =>
          prisma.transferEntry.aggregate({
            where: { businessMonthId: month.id, date },
            _sum: { amount: true },
            _count: { _all: true },
          }),
        () =>
          prisma.transferEntry.findMany({
            where: { businessMonthId: month.id, date },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              createdAt: true,
              serviceKey: true,
              note: true,
              amount: true,
            },
          }),
        () =>
          prisma.repairJob.aggregate({
            where: {
              businessMonthId: month.id,
              status: "DELIVERED",
              deliveredAt: date,
            },
            _sum: { profit: true },
            _count: { _all: true },
          }),
        () =>
          prisma.repairJob.findMany({
            where: {
              businessMonthId: month.id,
              status: "DELIVERED",
              deliveredAt: date,
            },
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: {
              id: true,
              updatedAt: true,
              device: true,
              salePrice: true,
            },
          }),
        () =>
          prisma.repairJob.aggregate({
            where: {
              businessMonthId: month.id,
              status: "REPAIRED_PENDING_PICKUP",
            },
            _sum: { salePrice: true },
            _count: { _all: true },
          }),
        () =>
          prisma.repairJob.count({
            where: {
              status: "REPAIRED_PENDING_PICKUP",
              businessMonth: { userId },
            },
          }),
        () =>
          prisma.repairJob.count({
            where: {
              businessMonthId: month.id,
              status: { in: ["RECEIVED", "IN_PROGRESS", "REPAIRED_PENDING_PICKUP"] },
            },
          }),
        () =>
          prisma.$queryRaw<Array<{ id: string; name: string; stockQty: number; minStock: number }>>`
          SELECT "id", "name", "stockQty", "minStock"
          FROM "Product"
          WHERE "userId" = ${userId}
            AND "isActive" = true
            AND "stockQty" <= "minStock"
          ORDER BY ("stockQty" - "minStock") ASC, "name" ASC
          LIMIT 5
        `,
        () =>
          prisma
            .$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::bigint AS count
            FROM "Product"
            WHERE "userId" = ${userId}
              AND "isActive" = true
              AND "stockQty" <= "minStock"
          `
            .then((rows) => Number(rows[0]?.count ?? 0)),
        () =>
          prisma.sale.groupBy({
            by: ["date"],
            where: { userId, date: { gte: start7, lte: date } },
            _sum: { total: true, totalCost: true },
          }),
        () =>
          prisma.$queryRaw<[{ value: string | null }]>`
          SELECT COALESCE(SUM("buyPrice" * "stockQty"), 0)::text AS value
          FROM "Product"
          WHERE "userId" = ${userId} AND "isActive" = true
        `,
        () => prisma.product.count({ where: { userId, isActive: true } }),
        () =>
          prisma.businessMonth.findUnique({
            where: {
              userId_year_month: { userId, year: prev.year, month: prev.month },
            },
          }),
        () => getDashboard(month.id),
      ],
      POOL_CONCURRENCY,
    );

    type DayAgg = { _sum: Record<string, { toString(): string } | null>; _count: { _all: number } };
    const salesDayAgg = batch[0] as DayAgg;
    const salesRecent = batch[1] as Array<{
      id: string;
      createdAt: Date;
      customerName: string | null;
      total: { toString(): string };
    }>;
    const rechargeDayAgg = batch[2] as DayAgg;
    const rechargeRecent = batch[3] as Array<{
      id: string;
      createdAt: Date;
      operator: string;
      note: string | null;
      amount: { toString(): string };
    }>;
    const transferDayAgg = batch[4] as DayAgg;
    const transferRecent = batch[5] as Array<{
      id: string;
      createdAt: Date;
      serviceKey: string;
      note: string | null;
      amount: { toString(): string };
    }>;
    const deliveredDayAgg = batch[6] as DayAgg;
    const deliveredRecent = batch[7] as Array<{
      id: string;
      updatedAt: Date;
      device: string | null;
      salePrice: { toString(): string };
    }>;
    const pendingPickupAgg = batch[8] as DayAgg;
    const undeliveredAll = batch[9] as number;
    const activeRepairs = batch[10] as number;
    const lowStockItems = batch[11] as Array<{
      id: string;
      name: string;
      stockQty: number;
      minStock: number;
    }>;
    const lowStockCount = batch[12] as number;
    const salesAgg = batch[13] as Array<{
      date: Date;
      _sum: { total: { toString(): string } | null; totalCost: { toString(): string } | null };
    }>;
    const stockAgg = batch[14] as [{ value: string | null }];
    const productCount = batch[15] as number;
    const prevMonthRecord = batch[16] as { id: string } | null;
    const monthDashboard = batch[17] as Awaited<ReturnType<typeof getDashboard>>;

    const salesTotal = d(salesDayAgg._sum.total ?? 0);
    const salesProfit = salesTotal.minus(d(salesDayAgg._sum.totalCost ?? 0));
    const salesCount = salesDayAgg._count._all;
    const rechargeTotal = d(rechargeDayAgg._sum.amount ?? 0);
    const transferTotal = d(transferDayAgg._sum.amount ?? 0);
    const repairProfit = d(deliveredDayAgg._sum.profit ?? 0);
    const repairDelivered = deliveredDayAgg._count._all;
    const repairPendingCount = pendingPickupAgg._count._all;
    const repairPendingBalance = d(pendingPickupAgg._sum.salePrice ?? 0);
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
      ...salesRecent.map((s) => ({
        id: s.id,
        at: s.createdAt.toISOString(),
        type: "SALE" as const,
        title: "Sale completed",
        subtitle: s.customerName ? `Customer: ${s.customerName}` : undefined,
        amount: fmt(d(s.total)),
      })),
      ...rechargeRecent.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        type: "RECHARGE" as const,
        title: `Recharge ${e.operator}`,
        subtitle: e.note ?? undefined,
        amount: fmt(d(e.amount)),
      })),
      ...transferRecent.map((e) => ({
        id: e.id,
        at: e.createdAt.toISOString(),
        type: "TRANSFER" as const,
        title: `Money transfer ${e.serviceKey}`,
        subtitle: e.note ?? undefined,
        amount: fmt(d(e.amount)),
      })),
      ...deliveredRecent.map((j) => ({
        id: j.id,
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
      salesCount,
      rechargeTotal: fmt(rechargeTotal),
      transferTotal: fmt(transferTotal),
      activeRepairs,
      repairDelivered,
      repairProfit: fmt(repairProfit),
      repairPendingCount,
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
