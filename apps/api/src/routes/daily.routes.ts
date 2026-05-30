import { Router } from "express";
import {
  bulkMoneyTransferSchema,
  bulkRechargeSchema,
  bulkRepairSchema,
  bulkMobileSchema,
  bulkExtraIncomeSchema,
  bulkShopExpenseSchema,
  bulkDamageSchema,
  bulkPartySchema,
  bulkUdhharSchema,
  bulkBankSchema,
  bulkWithdrawalSchema,
  paginationQuerySchema,
} from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { assertMonthAccess } from "../services/month-access.js";
import { paginate, dateRangeFilter } from "../lib/pagination.js";
import { parseDate, fmt, d } from "../lib/decimal.js";
import {
  moneyTransferTotal,
  rechargeTotal,
  profit,
  shopExpenseTotal,
  damageAmount,
  bankTotal,
  withdrawalTotal,
  partyOutstanding,
  udhharNet,
} from "../services/calculations.js";

export const dailyRouter = Router({ mergeParams: true });
dailyRouter.use(requireAuth);

function monthId(req: { params: { id?: string } }): string {
  const id = req.params.id;
  if (!id) throw new Error("Month id required");
  return id;
}

async function guardMonth(req: { params: { id?: string } }, userId: string) {
  return assertMonthAccess(monthId(req), userId);
}

function serializeRow<T extends Record<string, unknown>>(row: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 10);
    else if (typeof v === "object" && v !== null && "toFixed" in (v as object)) {
      out[k] = fmt(d(v as { toString(): string }));
    } else out[k] = v;
  }
  return out;
}

// Money Transfer
dailyRouter.get("/money-transfers", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.moneyTransferDay.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.moneyTransferDay.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/money-transfers/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkMoneyTransferSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const { date, ...fields } = e;
        const total = moneyTransferTotal(e);
        const day = parseDate(date);
        return prisma.moneyTransferDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: monthId(req),
              date: day,
            },
          },
          create: {
            businessMonthId: monthId(req),
            date: day,
            ...fields,
            total,
          },
          update: { ...fields, total },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Recharge
dailyRouter.get("/recharges", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.rechargeDay.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.rechargeDay.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/recharges/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkRechargeSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const { date, ...fields } = e;
        const total = rechargeTotal(e);
        const day = parseDate(date);
        return prisma.rechargeDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: monthId(req),
              date: day,
            },
          },
          create: { businessMonthId: monthId(req), date: day, ...fields, total },
          update: { ...fields, total },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Repair
dailyRouter.put("/repairs/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkRepairSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const p = profit(e.sale, e.cost);
        return prisma.repairDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: monthId(req),
              date: parseDate(e.date),
            },
          },
          create: {
            businessMonthId: monthId(req),
            date: parseDate(e.date),
            jobCount: e.jobCount,
            sale: e.sale,
            cost: e.cost,
            profit: p,
          },
          update: {
            jobCount: e.jobCount,
            sale: e.sale,
            cost: e.cost,
            profit: p,
          },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Mobile accessories
dailyRouter.put("/mobile-accessories/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkMobileSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const p = profit(e.sale, e.cost);
        return prisma.mobileAccessoryDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: monthId(req),
              date: parseDate(e.date),
            },
          },
          create: {
            businessMonthId: monthId(req),
            date: parseDate(e.date),
            sale: e.sale,
            cost: e.cost,
            profit: p,
          },
          update: { sale: e.sale, cost: e.cost, profit: p },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Extra income
dailyRouter.put("/extra-income/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkExtraIncomeSchema.parse(req.body);
    for (const e of entries) {
      if (d(e.amount).eq(0) && !e.description) continue;
      await prisma.extraIncomeEntry.deleteMany({
        where: { businessMonthId: monthId(req), date: parseDate(e.date) },
      });
      if (d(e.amount).gt(0) || e.description) {
        await prisma.extraIncomeEntry.create({
          data: {
            businessMonthId: monthId(req),
            date: parseDate(e.date),
            description: e.description,
            amount: e.amount,
          },
        });
      }
    }
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Shop expenses
dailyRouter.get("/shop-expenses", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.shopExpenseDay.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.shopExpenseDay.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/shop-expenses/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkShopExpenseSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const { date: dStr, ...fields } = e;
        const day = parseDate(dStr);
        const total = shopExpenseTotal(e);
        return prisma.shopExpenseDay.upsert({
          where: {
            businessMonthId_date: { businessMonthId: monthId(req), date: day },
          },
          create: { businessMonthId: monthId(req), date: day, ...fields, total },
          update: { ...fields, total },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Damage
dailyRouter.get("/damages", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.damageDay.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.damageDay.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/damages/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkDamageSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const { date: dStr, ...fields } = e;
        const day = parseDate(dStr);
        const amount = damageAmount(e);
        return prisma.damageDay.upsert({
          where: {
            businessMonthId_date: { businessMonthId: monthId(req), date: day },
          },
          create: { businessMonthId: monthId(req), date: day, ...fields, amount },
          update: { ...fields, amount },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Parties
dailyRouter.get("/parties", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const q = paginationQuerySchema.parse(req.query);
    const where: {
      businessMonthId: string;
      partyName?: { contains: string; mode: "insensitive" };
    } = { businessMonthId: monthId(req) };
    if (q.search) where.partyName = { contains: q.search, mode: "insensitive" };
    const total = await prisma.partyLedgerEntry.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.partyLedgerEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { partyName: "asc" }],
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/parties/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkPartySchema.parse(req.body);
    await prisma.partyLedgerEntry.createMany({
      data: entries.map((e) => ({
        businessMonthId: monthId(req),
        date: parseDate(e.date),
        partyName: e.partyName,
        materialIn: e.materialIn,
        paymentOut: e.paymentOut,
        outstanding: partyOutstanding(e),
      })),
      skipDuplicates: true,
    });
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Udhhar
dailyRouter.get("/udhhar", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.udhharDay.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.udhharDay.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/udhhar/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkUdhharSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) =>
        prisma.udhharDay.upsert({
          where: {
            businessMonthId_date: {
              businessMonthId: monthId(req),
              date: parseDate(e.date),
            },
          },
          create: {
            businessMonthId: monthId(req),
            date: parseDate(e.date),
            paymentOut: e.paymentOut,
            paymentIn: e.paymentIn,
            net: udhharNet(e),
          },
          update: {
            paymentOut: e.paymentOut,
            paymentIn: e.paymentIn,
            net: udhharNet(e),
          },
        }),
      ),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Bank balances
dailyRouter.get("/bank-balances", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.bankBalanceDay.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.bankBalanceDay.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/bank-balances/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkBankSchema.parse(req.body);
    await prisma.$transaction(
      entries.map((e) => {
        const { date: dStr, ...fields } = e;
        const day = parseDate(dStr);
        const total = bankTotal(e);
        return prisma.bankBalanceDay.upsert({
          where: {
            businessMonthId_date: { businessMonthId: monthId(req), date: day },
          },
          create: { businessMonthId: monthId(req), date: day, ...fields, total },
          update: { ...fields, total },
        });
      }),
    );
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});

// Withdrawals
dailyRouter.get("/withdrawals", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const q = paginationQuerySchema.parse(req.query);
    const where = {
      businessMonthId: mid,
      ...(dateRangeFilter(q) && { date: dateRangeFilter(q) }),
    };
    const total = await prisma.withdrawal.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.withdrawal.findMany({
      where,
      orderBy: { date: "asc" },
      skip,
      take,
    });
    res.json({
      data: rows.map(serializeRow),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/withdrawals/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkWithdrawalSchema.parse(req.body);
    for (const e of entries) {
      const total = withdrawalTotal(e);
      if (d(total).eq(0) && !e.description) continue;
      await prisma.withdrawal.deleteMany({
        where: { businessMonthId: monthId(req), date: parseDate(e.date) },
      });
      if (d(total).gt(0)) {
        await prisma.withdrawal.create({
          data: {
            businessMonthId: monthId(req),
            date: parseDate(e.date),
            description: e.description,
            cash: e.cash,
            bank: e.bank,
            total,
          },
        });
      }
    }
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});
