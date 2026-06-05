import { Router } from "express";
import {
  rechargeBatchSchema,
  transferEntrySchema,
  repairIntakeSchema,
  repairJobSchema,
  updateRepairJobSchema,
  partySchema,
  partyTransactionSchema,
  paginationQuerySchema,
} from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { assertMonthAccess } from "../services/month-access.js";
import { paginate } from "../lib/pagination.js";
import { d, fmt } from "../lib/decimal.js";
import { profit } from "../services/calculations.js";
import {
  rollupRechargeDay,
  rollupTransferDay,
  rollupRepairDay,
  rollupPartyLedger,
} from "../services/rollup.service.js";
import {
  mapRepairJobDto,
  buildStatusUpdateData,
  rollupDatesForJob,
} from "../services/repair-workflow.service.js";

export const entriesRouter = Router({ mergeParams: true });
entriesRouter.use(requireAuth);

function monthIdFromParams(params: Record<string, string | undefined>): string {
  const id = params.id;
  if (!id) throw new Error("Month id required");
  return id;
}

function parseDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

async function guard(req: { params: Record<string, string | undefined> }, userId: string) {
  return assertMonthAccess(monthIdFromParams(req.params), userId);
}

// Recharge entries
entriesRouter.get("/recharge-entries", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const q = paginationQuerySchema.parse(req.query);
    const date = req.query.date as string | undefined;
    const where = {
      businessMonthId: mid,
      ...(date && { date: parseDate(date) }),
    };
    const total = await prisma.rechargeEntry.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.rechargeEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        operator: r.operator,
        entryType: r.entryType,
        amount: fmt(d(r.amount)),
        rechargeAmount: r.rechargeAmount != null ? fmt(d(r.rechargeAmount)) : null,
        note: r.note,
      })),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

entriesRouter.post("/recharge-entries", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = rechargeBatchSchema.parse(req.body);
    const date = parseDate(body.date);

    const amounts: Array<{ entryType: "SALE_PROFIT" | "CHILLAR" | "ACT" | "MNP"; amount: number }> = [
      { entryType: "SALE_PROFIT", amount: body.saleProfit },
      { entryType: "CHILLAR", amount: body.chillar },
      { entryType: "ACT", amount: body.act },
      { entryType: "MNP", amount: body.mnp },
    ];

    if (body.rechargeAmount <= 0) {
      res.status(400).json({ error: "Enter the actual recharge amount" });
      return;
    }

    const toCreate = amounts.filter((a) => a.amount > 0);
    const faceValue = fmt(d(body.rechargeAmount));

    const created = await prisma.$transaction(
      toCreate.map((item) =>
        prisma.rechargeEntry.create({
          data: {
            businessMonthId: mid,
            date,
            operator: body.operator,
            entryType: item.entryType,
            amount: fmt(d(item.amount)),
            rechargeAmount: faceValue,
          },
        }),
      ),
    );

    // Store face value even when no profit lines were entered
    if (created.length === 0) {
      const entry = await prisma.rechargeEntry.create({
        data: {
          businessMonthId: mid,
          date,
          operator: body.operator,
          entryType: "SALE_PROFIT",
          amount: fmt(d(0)),
          rechargeAmount: faceValue,
        },
      });
      created.push(entry);
    }

    await rollupRechargeDay(mid, date);
    res.status(201).json({
      date: body.date,
      operator: body.operator,
      entries: created.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        amount: fmt(d(entry.amount)),
      })),
    });
  } catch (e) {
    next(e);
  }
});

entriesRouter.delete("/recharge-entries/:entryId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const entry = await prisma.rechargeEntry.findFirst({
      where: { id: req.params.entryId, businessMonthId: mid },
    });
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const date = entry.date;
    await prisma.rechargeEntry.delete({ where: { id: entry.id } });
    await rollupRechargeDay(mid, date);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Transfer entries
entriesRouter.get("/transfer-entries", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const q = paginationQuerySchema.parse(req.query);
    const date = req.query.date as string | undefined;
    const where = {
      businessMonthId: mid,
      ...(date && { date: parseDate(date) }),
    };
    const total = await prisma.transferEntry.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.transferEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        serviceKey: r.serviceKey,
        amount: fmt(d(r.amount)),
        note: r.note,
      })),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

entriesRouter.post("/transfer-entries", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = transferEntrySchema.parse(req.body);
    const date = parseDate(body.date);
    const entry = await prisma.transferEntry.create({
      data: {
        businessMonthId: mid,
        date,
        serviceKey: body.serviceKey,
        amount: fmt(d(body.amount)),
        note: body.note,
      },
    });
    await rollupTransferDay(mid, date);
    res.status(201).json({
      id: entry.id,
      date: body.date,
      serviceKey: entry.serviceKey,
      amount: fmt(d(entry.amount)),
    });
  } catch (e) {
    next(e);
  }
});

entriesRouter.delete("/transfer-entries/:entryId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const entry = await prisma.transferEntry.findFirst({
      where: { id: req.params.entryId, businessMonthId: mid },
    });
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const date = entry.date;
    await prisma.transferEntry.delete({ where: { id: entry.id } });
    await rollupTransferDay(mid, date);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Repair jobs
entriesRouter.get("/repair-jobs", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const q = paginationQuerySchema.parse(req.query);
    const date = req.query.date as string | undefined;
    const status = req.query.status as string | undefined;
    const where = {
      businessMonthId: mid,
      ...(date && { date: parseDate(date) }),
      ...(status && { status: status as never }),
    };
    const total = await prisma.repairJob.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.repairJob.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { date: "desc" }],
      skip,
      take,
    });
    res.json({
      data: rows.map(mapRepairJobDto),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

entriesRouter.post("/repair-jobs/intake", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = repairIntakeSchema.parse(req.body);
    const date = parseDate(body.date);
    const partsCost = fmt(d(body.repairCost));
    const labourCost = fmt(d(0));
    const salePrice = fmt(d(body.customerCharge));
    const profitVal = profit(salePrice, partsCost);
    const job = await prisma.repairJob.create({
      data: {
        businessMonthId: mid,
        date,
        status: "RECEIVED",
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        device: body.device,
        issueDescription: body.issueDescription,
        partsCost,
        labourCost,
        salePrice,
        profit: profitVal,
        note: body.note,
      },
    });
    res.status(201).json(mapRepairJobDto(job));
  } catch (e) {
    next(e);
  }
});

entriesRouter.post("/repair-jobs", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = repairJobSchema.parse(req.body);
    const date = parseDate(body.date);
    const cost = d(body.partsCost).plus(d(body.labourCost));
    const profitVal = profit(body.salePrice, cost.toString());
    const job = await prisma.repairJob.create({
      data: {
        businessMonthId: mid,
        date,
        status: "DELIVERED",
        customerName: body.customerName,
        device: body.device,
        partsCost: fmt(d(body.partsCost)),
        labourCost: fmt(d(body.labourCost)),
        salePrice: fmt(d(body.salePrice)),
        profit: profitVal,
        deliveredAt: date,
        note: body.note,
      },
    });
    await rollupRepairDay(mid, date);
    res.status(201).json(mapRepairJobDto(job));
  } catch (e) {
    next(e);
  }
});

entriesRouter.patch("/repair-jobs/:jobId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = updateRepairJobSchema.parse(req.body);
    const existing = await prisma.repairJob.findFirst({
      where: { id: req.params.jobId, businessMonthId: mid },
    });
    if (!existing) {
      res.status(404).json({ error: "Repair job not found" });
      return;
    }
    const updateData = buildStatusUpdateData(existing, body);
    const job = await prisma.repairJob.update({
      where: { id: existing.id },
      data: updateData,
    });
    for (const dte of rollupDatesForJob(existing)) {
      await rollupRepairDay(mid, dte);
    }
    for (const dte of rollupDatesForJob(job)) {
      await rollupRepairDay(mid, dte);
    }
    res.json(mapRepairJobDto(job));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    res.status(400).json({ error: msg });
  }
});

// Parties (user-scoped)
export const partiesRouter = Router();
partiesRouter.use(requireAuth);

partiesRouter.get("/", async (req, res, next) => {
  try {
    const parties = await prisma.party.findMany({
      where: { userId: req.user!.userId },
      orderBy: { name: "asc" },
    });
    res.json({
      data: parties.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
      })),
    });
  } catch (e) {
    next(e);
  }
});

partiesRouter.post("/", async (req, res, next) => {
  try {
    const body = partySchema.parse(req.body);
    const party = await prisma.party.create({
      data: {
        userId: req.user!.userId,
        name: body.name,
        phone: body.phone,
      },
    });
    res.status(201).json({ id: party.id, name: party.name, phone: party.phone });
  } catch (e) {
    next(e);
  }
});

entriesRouter.get("/party-transactions", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const q = paginationQuerySchema.parse(req.query);
    const where = { businessMonthId: mid };
    const total = await prisma.partyTransaction.count({ where });
    const { skip, take, totalPages } = paginate(q.page, q.limit, total);
    const rows = await prisma.partyTransaction.findMany({
      where,
      include: { party: true },
      orderBy: { date: "desc" },
      skip,
      take,
    });
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        partyId: r.partyId,
        partyName: r.party.name,
        date: r.date.toISOString().slice(0, 10),
        materialIn: fmt(d(r.materialIn)),
        paymentOut: fmt(d(r.paymentOut)),
        note: r.note,
      })),
      meta: { page: q.page, limit: q.limit, total, totalPages },
    });
  } catch (e) {
    next(e);
  }
});

entriesRouter.post("/party-transactions", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = partyTransactionSchema.parse(req.body);
    const date = parseDate(body.date);
    const tx = await prisma.partyTransaction.create({
      data: {
        partyId: body.partyId,
        businessMonthId: mid,
        date,
        materialIn: body.materialIn,
        paymentOut: body.paymentOut,
        note: body.note,
      },
      include: { party: true },
    });
    await rollupPartyLedger(mid, body.partyId);
    res.status(201).json({
      id: tx.id,
      partyName: tx.party.name,
      date: body.date,
      materialIn: fmt(d(tx.materialIn)),
      paymentOut: fmt(d(tx.paymentOut)),
    });
  } catch (e) {
    next(e);
  }
});
