import { Router } from "express";
import {
  rechargeBatchSchema,
  type RechargeBatchInput,
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
  resolveRepairCompleteCostsInTx,
  buildStatusUpdateData,
  rollupDatesForJob,
  validateRepairPartSelection,
} from "../services/repair-workflow.service.js";
import {
  fireNotification,
  notifyLowStockIfNeeded,
  notifyRepairPickup,
  notifyRepairReceived,
} from "../services/notification.service.js";

export const entriesRouter = Router({ mergeParams: true });
entriesRouter.use(requireAuth);

function monthIdFromParams(params: Record<string, string | undefined>): string {
  const id = params.id;
  if (!id) throw new Error("Month id required");
  return id;
}

function mapRechargeEntry(r: {
  id: string;
  date: Date;
  operator: string;
  entryType: string;
  amount: { toString(): string };
  rechargeAmount: { toString(): string } | null;
  saleProfit: { toString(): string } | null;
  chillar: { toString(): string } | null;
  act: { toString(): string } | null;
  mnp: { toString(): string } | null;
  note: string | null;
}) {
  return {
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    operator: r.operator,
    entryType: r.entryType,
    amount: fmt(d(r.amount)),
    rechargeAmount: r.rechargeAmount != null ? fmt(d(r.rechargeAmount)) : null,
    saleProfit: r.saleProfit != null ? fmt(d(r.saleProfit)) : null,
    chillar: r.chillar != null ? fmt(d(r.chillar)) : null,
    act: r.act != null ? fmt(d(r.act)) : null,
    mnp: r.mnp != null ? fmt(d(r.mnp)) : null,
    note: r.note,
  };
}

function parseDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

async function guard(req: { params: Record<string, string | undefined> }, userId: string) {
  return assertMonthAccess(monthIdFromParams(req.params), userId);
}

function buildRechargeEntryData(body: RechargeBatchInput) {
  const amounts: Array<{ entryType: "SALE_PROFIT" | "CHILLAR" | "ACT" | "MNP"; amount: number }> = [
    { entryType: "SALE_PROFIT", amount: body.saleProfit },
    { entryType: "CHILLAR", amount: body.chillar },
    { entryType: "ACT", amount: body.act },
    { entryType: "MNP", amount: body.mnp },
  ];

  const faceValue = body.rechargeAmount > 0 ? fmt(d(body.rechargeAmount)) : null;
  const saleProfit = fmt(d(body.saleProfit));
  const chillar = fmt(d(body.chillar));
  const act = fmt(d(body.act));
  const mnp = fmt(d(body.mnp));
  const totalAmount = fmt(
    d(body.saleProfit).plus(d(body.chillar)).plus(d(body.act)).plus(d(body.mnp)),
  );
  const activeTypes = amounts.filter((a) => a.amount > 0);
  const entryType =
    activeTypes.length === 1
      ? activeTypes[0]!.entryType
      : activeTypes.length > 1
        ? "MULTI"
        : "SALE_PROFIT";

  return {
    date: parseDate(body.date),
    operator: body.operator,
    entryType,
    amount: totalAmount,
    rechargeAmount: faceValue,
    saleProfit,
    chillar,
    act,
    mnp,
  };
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
      isActive: true,
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
      data: rows.map(mapRechargeEntry),
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
    const entryData = buildRechargeEntryData(body);

    const entry = await prisma.rechargeEntry.create({
      data: {
        businessMonthId: mid,
        ...entryData,
      },
    });

    await rollupRechargeDay(mid, entryData.date);
    res.status(201).json(mapRechargeEntry(entry));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    res.status(400).json({ error: msg });
  }
});

entriesRouter.patch("/recharge-entries/:entryId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = rechargeBatchSchema.parse(req.body);
    const existing = await prisma.rechargeEntry.findFirst({
      where: { id: req.params.entryId, businessMonthId: mid, isActive: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const entryData = buildRechargeEntryData(body);
    const entry = await prisma.rechargeEntry.update({
      where: { id: existing.id },
      data: entryData,
    });

    const dates = new Set([existing.date.toISOString(), entryData.date.toISOString()]);
    for (const iso of dates) {
      await rollupRechargeDay(mid, new Date(iso));
    }

    res.json(mapRechargeEntry(entry));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    res.status(400).json({ error: msg });
  }
});

entriesRouter.delete("/recharge-entries/:entryId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const entry = await prisma.rechargeEntry.findFirst({
      where: { id: req.params.entryId, businessMonthId: mid, isActive: true },
    });
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const date = entry.date;
    await prisma.rechargeEntry.update({
      where: { id: entry.id },
      data: { isActive: false },
    });
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

entriesRouter.patch("/transfer-entries/:entryId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const body = transferEntrySchema.parse(req.body);
    const existing = await prisma.transferEntry.findFirst({
      where: { id: req.params.entryId, businessMonthId: mid },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const date = parseDate(body.date);
    const entry = await prisma.transferEntry.update({
      where: { id: existing.id },
      data: {
        date,
        serviceKey: body.serviceKey,
        amount: fmt(d(body.amount)),
        note: body.note,
      },
    });

    const dates = new Set([existing.date.toISOString(), date.toISOString()]);
    for (const iso of dates) {
      await rollupTransferDay(mid, new Date(iso));
    }

    res.json({
      id: entry.id,
      date: body.date,
      serviceKey: entry.serviceKey,
      amount: fmt(d(entry.amount)),
      note: entry.note,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    res.status(400).json({ error: msg });
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
      include: {
        parts: { include: { product: { select: { name: true } } } },
      },
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

entriesRouter.get("/repair-jobs/:jobId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const job = await prisma.repairJob.findFirst({
      where: { id: req.params.jobId, businessMonthId: mid },
      include: {
        parts: { include: { product: { select: { name: true } } } },
      },
    });
    if (!job) {
      res.status(404).json({ error: "Repair job not found" });
      return;
    }
    res.json(mapRepairJobDto(job));
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
    fireNotification(() =>
      notifyRepairReceived(req.user!.userId, {
        id: job.id,
        customerName: job.customerName,
        device: job.device,
      }),
    );
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
    const completingRepair =
      body.status === "REPAIRED_PENDING_PICKUP" &&
      existing.status !== "REPAIRED_PENDING_PICKUP";
    if (completingRepair) {
      validateRepairPartSelection(body);
    }
    const job = await prisma.$transaction(async (tx) => {
      let statusInput: typeof body = { ...body };
      if (completingRepair) {
        const costs = await resolveRepairCompleteCostsInTx(
          tx,
          body,
          req.user!.userId,
          existing.id,
        );
        statusInput = {
          ...body,
          partsCost: costs.partsCost,
          labourCost: costs.labourCost,
          repairCost: undefined,
        };
      }

      const updateData = buildStatusUpdateData(existing, statusInput);
      return tx.repairJob.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          parts: { include: { product: { select: { name: true } } } },
        },
      });
    });
    for (const dte of rollupDatesForJob(existing)) {
      await rollupRepairDay(mid, dte);
    }
    for (const dte of rollupDatesForJob(job)) {
      await rollupRepairDay(mid, dte);
    }
    if (
      body.status === "REPAIRED_PENDING_PICKUP" &&
      existing.status !== "REPAIRED_PENDING_PICKUP"
    ) {
      fireNotification(() =>
        notifyRepairPickup(req.user!.userId, {
          id: job.id,
          customerName: job.customerName,
          device: job.device,
        }),
      );
    }
    if (body.status === "REPAIRED_PENDING_PICKUP" && body.partsUsed?.length) {
      for (const part of body.partsUsed) {
        const product = await prisma.product.findFirst({
          where: { id: part.productId, userId: req.user!.userId },
        });
        if (product) {
          fireNotification(() =>
            notifyLowStockIfNeeded(
              req.user!.userId,
              product.id,
              product.name,
              product.stockQty,
              product.minStock,
            ),
          );
        }
      }
    }
    res.json(mapRepairJobDto(job));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    res.status(400).json({ error: msg });
  }
});

entriesRouter.delete("/repair-jobs/:jobId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const existing = await prisma.repairJob.findFirst({
      where: { id: req.params.jobId, businessMonthId: mid },
      include: { parts: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Repair job not found" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      for (const part of existing.parts) {
        await tx.product.update({
          where: { id: part.productId },
          data: { stockQty: { increment: part.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: part.productId,
            type: "IN",
            quantity: part.quantity,
            unitCost: part.unitCost,
            note: `Repair job ${existing.id} deleted`,
          },
        });
      }
      await tx.repairJob.delete({ where: { id: existing.id } });
    });
    for (const dte of rollupDatesForJob(existing)) {
      await rollupRepairDay(mid, dte);
    }
    res.status(204).end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
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

entriesRouter.delete("/party-transactions/:txId", async (req, res, next) => {
  try {
    await guard(req, req.user!.userId);
    const mid = monthIdFromParams(req.params);
    const tx = await prisma.partyTransaction.findFirst({
      where: { id: req.params.txId, businessMonthId: mid },
    });
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    const partyId = tx.partyId;
    await prisma.partyTransaction.delete({ where: { id: tx.id } });
    await rollupPartyLedger(mid, partyId);
    res.status(204).end();
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
