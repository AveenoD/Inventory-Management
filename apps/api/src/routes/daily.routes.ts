import { Router } from "express";
import {
  bulkMoneyTransferSchema,
  bulkRechargeSchema,
  bulkRepairSchema,
  bulkMobileSchema,
  bulkExtraIncomeSchema,
  bulkShopExpenseSchema,
  bulkDamageSchema,
  createExpenseEntrySchema,
  bulkPartySchema,
  bulkUdhharSchema,
  bulkBankSchema,
  bulkWithdrawalSchema,
  createWithdrawalSchema,
  paginationQuerySchema,
} from "@sk-mobile/shared";
import { getDashboard } from "../services/dashboard.service.js";
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
    const mid = monthId(req);
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        if (d(e.amount).eq(0) && !e.description) continue;
        await tx.extraIncomeEntry.deleteMany({
          where: { businessMonthId: mid, date: parseDate(e.date) },
        });
        if (d(e.amount).gt(0) || e.description) {
          await tx.extraIncomeEntry.create({
            data: {
              businessMonthId: mid,
              date: parseDate(e.date),
              description: e.description,
              amount: e.amount,
            },
          });
        }
      }
    });
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

function mergeDescription(existing: string | null | undefined, next?: string) {
  const a = (existing ?? "").trim();
  const b = (next ?? "").trim();
  if (!b) return a || null;
  if (!a) return b;
  return `${a} · ${b}`;
}

dailyRouter.post("/expenses/entry", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const body = createExpenseEntrySchema.parse(req.body);
    const day = parseDate(body.date);
    const amount = d(body.amount);

    if (body.category === "ACCESSORIES_DAMAGE" || body.category === "REPAIRING_DAMAGE") {
      const existing = await prisma.damageDay.findUnique({
        where: { businessMonthId_date: { businessMonthId: mid, date: day } },
      });

      const accessoriesAmount =
        body.category === "ACCESSORIES_DAMAGE"
          ? d(existing?.accessoriesAmount ?? 0).plus(amount)
          : d(existing?.accessoriesAmount ?? 0);
      const repairingAmount =
        body.category === "REPAIRING_DAMAGE"
          ? d(existing?.repairingAmount ?? 0).plus(amount)
          : d(existing?.repairingAmount ?? 0);
      const accessoriesDescription =
        body.category === "ACCESSORIES_DAMAGE"
          ? mergeDescription(existing?.accessoriesDescription, body.description)
          : existing?.accessoriesDescription ?? null;
      const repairingDescription =
        body.category === "REPAIRING_DAMAGE"
          ? mergeDescription(existing?.repairingDescription, body.description)
          : existing?.repairingDescription ?? null;

      const row = await prisma.damageDay.upsert({
        where: { businessMonthId_date: { businessMonthId: mid, date: day } },
        create: {
          businessMonthId: mid,
          date: day,
          accessoriesDescription,
          accessoriesAmount,
          repairingDescription,
          repairingAmount,
          amount: fmt(accessoriesAmount.plus(repairingAmount)),
        },
        update: {
          accessoriesDescription,
          accessoriesAmount,
          repairingDescription,
          repairingAmount,
          amount: fmt(accessoriesAmount.plus(repairingAmount)),
        },
      });
      res.status(201).json({ ok: true, data: serializeRow(row) });
      return;
    }

    const existing = await prisma.shopExpenseDay.findUnique({
      where: { businessMonthId_date: { businessMonthId: mid, date: day } },
    });

    let salaryAmount = d(existing?.salaryAmount ?? 0);
    let teaAmount = d(existing?.teaAmount ?? 0);
    let shopExpAmount = d(existing?.shopExpAmount ?? 0);
    let salaryDescription = existing?.salaryDescription ?? null;
    let teaDescription = existing?.teaDescription ?? null;
    let shopExpDescription = existing?.shopExpDescription ?? null;

    if (body.category === "SALARY") {
      salaryAmount = salaryAmount.plus(amount);
      salaryDescription = mergeDescription(salaryDescription, body.description);
    } else if (body.category === "TEA") {
      teaAmount = teaAmount.plus(amount);
      teaDescription = mergeDescription(teaDescription, body.description);
    } else {
      shopExpAmount = shopExpAmount.plus(amount);
      shopExpDescription = mergeDescription(shopExpDescription, body.description);
    }

    const total = fmt(salaryAmount.plus(teaAmount).plus(shopExpAmount));
    const row = await prisma.shopExpenseDay.upsert({
      where: { businessMonthId_date: { businessMonthId: mid, date: day } },
      create: {
        businessMonthId: mid,
        date: day,
        salaryDescription,
        salaryAmount,
        teaDescription,
        teaAmount,
        shopExpDescription,
        shopExpAmount,
        total,
      },
      update: {
        salaryDescription,
        salaryAmount,
        teaDescription,
        teaAmount,
        shopExpDescription,
        shopExpAmount,
        total,
      },
    });
    res.status(201).json({ ok: true, data: serializeRow(row) });
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

dailyRouter.post("/withdrawals", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const mid = monthId(req);
    const body = createWithdrawalSchema.parse(req.body);
    const amount = d(body.amount);
    const dash = await getDashboard(mid);
    const availableProfit = d(dash.netProfit);
    if (availableProfit.lte(0)) {
      res.status(400).json({
        error: "No profit available to withdraw this month.",
      });
      return;
    }
    if (amount.gt(availableProfit)) {
      res.status(400).json({
        error: `Insufficient profit. Available: ${fmt(availableProfit)}. You cannot withdraw more than the current month profit.`,
      });
      return;
    }

    const date = parseDate(body.date);
    const existing = await prisma.withdrawal.findFirst({
      where: { businessMonthId: mid, date },
    });

    if (existing) {
      const newCash = d(existing.cash).plus(amount);
      const newTotal = d(existing.total).plus(amount);
      await prisma.withdrawal.update({
        where: { id: existing.id },
        data: {
          cash: newCash,
          total: newTotal,
          description: body.description?.trim() || existing.description || "Withdrawal",
        },
      });
    } else {
      await prisma.withdrawal.create({
        data: {
          businessMonthId: mid,
          date,
          description: body.description?.trim() || "Withdrawal",
          cash: amount,
          bank: 0,
          total: amount,
        },
      });
    }

    res.status(201).json({ ok: true, amount: fmt(amount), availableProfit: fmt(availableProfit.minus(amount)) });
  } catch (e) {
    next(e);
  }
});

dailyRouter.put("/withdrawals/bulk", async (req, res, next) => {
  try {
    await guardMonth(req, req.user!.userId);
    const { entries } = bulkWithdrawalSchema.parse(req.body);
    const mid = monthId(req);
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        const total = withdrawalTotal(e);
        if (d(total).eq(0) && !e.description) continue;
        await tx.withdrawal.deleteMany({
          where: { businessMonthId: mid, date: parseDate(e.date) },
        });
        if (d(total).gt(0)) {
          await tx.withdrawal.create({
            data: {
              businessMonthId: mid,
              date: parseDate(e.date),
              description: e.description,
              cash: e.cash,
              bank: e.bank,
              total,
            },
          });
        }
      }
    });
    res.json({ ok: true, count: entries.length });
  } catch (e) {
    next(e);
  }
});
