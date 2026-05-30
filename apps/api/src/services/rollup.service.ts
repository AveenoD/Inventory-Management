import { prisma } from "../lib/prisma.js";
import { d, fmt } from "../lib/decimal.js";
import {
  moneyTransferTotal,
  rechargeTotal,
  profit,
  partyOutstanding,
} from "./calculations.js";

const RECHARGE_FIELD: Record<string, Record<string, string>> = {
  AIRTEL: {
    SALE_PROFIT: "airtelSaleProfit",
    CHILLAR: "airtelChillar",
    ACT: "airtelAct",
    MNP: "airtelMnp",
  },
  JIO: {
    SALE_PROFIT: "jioSaleProfit",
    CHILLAR: "jioChillar",
    ACT: "jioAct",
    MNP: "jioMnp",
  },
  VI: {
    SALE_PROFIT: "viSaleProfit",
    CHILLAR: "viChillar",
    ACT: "viAct",
    MNP: "viMnp",
  },
  BSNL: {
    SALE_PROFIT: "bsnlSaleProfit",
    CHILLAR: "bsnlChillar",
    ACT: "bsnlAct",
    MNP: "bsnlMnp",
  },
  ALL_IN_ONE: {
    SALE_PROFIT: "allInOneSaleProfit",
    CHILLAR: "allInOneChillar",
  },
};

const TRANSFER_KEYS = [
  "dmt99Dmt", "dmt99Aeps", "dmt99Nepal", "dmt99BillPay", "dmt99Qr",
  "dmt86Dmt", "dmt86Aeps", "dmt86Credit", "dmt86BillPay", "dmt86Wallet",
  "dmt86Qr", "dmt86Nepal", "imeAeps", "imeNepal",
] as const;

function emptyTransferRow() {
  return Object.fromEntries(TRANSFER_KEYS.map((k) => [k, 0])) as Record<string, number>;
}

function emptyRechargeRow() {
  return {
    airtelSaleProfit: 0, airtelChillar: 0, airtelAct: 0, airtelMnp: 0,
    jioSaleProfit: 0, jioChillar: 0, jioAct: 0, jioMnp: 0,
    viSaleProfit: 0, viChillar: 0, viAct: 0, viMnp: 0,
    bsnlSaleProfit: 0, bsnlChillar: 0, bsnlAct: 0, bsnlMnp: 0,
    allInOneSaleProfit: 0, allInOneChillar: 0,
  };
}

export async function rollupRechargeDay(businessMonthId: string, date: Date) {
  const entries = await prisma.rechargeEntry.findMany({
    where: { businessMonthId, date },
  });
  const row = emptyRechargeRow();
  for (const e of entries) {
    const field = RECHARGE_FIELD[e.operator]?.[e.entryType];
    if (field) {
      // Keep Decimal precision (avoid float drift)
      row[field as keyof typeof row] = Number(
        fmt(d(row[field as keyof typeof row]).plus(d(e.amount))),
      );
    }
  }
  const total = rechargeTotal(row);
  await prisma.rechargeDay.upsert({
    where: { businessMonthId_date: { businessMonthId, date } },
    create: { businessMonthId, date, ...row, total },
    update: { ...row, total },
  });
}

export async function rollupTransferDay(businessMonthId: string, date: Date) {
  const entries = await prisma.transferEntry.findMany({
    where: { businessMonthId, date },
  });
  const row = emptyTransferRow();
  for (const e of entries) {
    if (TRANSFER_KEYS.includes(e.serviceKey as (typeof TRANSFER_KEYS)[number])) {
      // Keep Decimal precision (avoid float drift)
      row[e.serviceKey] = Number(fmt(d(row[e.serviceKey]).plus(d(e.amount))));
    }
  }
  const total = moneyTransferTotal(row);
  await prisma.moneyTransferDay.upsert({
    where: { businessMonthId_date: { businessMonthId, date } },
    create: { businessMonthId, date, ...row, total },
    update: { ...row, total },
  });
}

export async function rollupRepairDay(businessMonthId: string, date: Date) {
  const dateStr = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const jobs = await prisma.repairJob.findMany({
    where: {
      businessMonthId,
      status: "DELIVERED",
      deliveredAt: dayStart,
    },
  });
  const jobCount = jobs.length;
  const sale = jobs.reduce((a, j) => a.plus(d(j.salePrice)), d(0));
  const cost = jobs.reduce((a, j) => a.plus(d(j.partsCost)).plus(d(j.labourCost)), d(0));
  const profitVal = sale.minus(cost);
  await prisma.repairDay.upsert({
    where: { businessMonthId_date: { businessMonthId, date } },
    create: {
      businessMonthId,
      date,
      jobCount,
      sale: fmt(sale),
      cost: fmt(cost),
      profit: fmt(profitVal),
    },
    update: {
      jobCount,
      sale: fmt(sale),
      cost: fmt(cost),
      profit: fmt(profitVal),
    },
  });
}

export async function rollupMobileDayFromSales(businessMonthId: string, date: Date) {
  const sales = await prisma.sale.findMany({
    where: { businessMonthId, date },
    include: { lines: true },
  });
  const sale = sales.reduce((a, s) => a.plus(d(s.total)), d(0));
  const cost = sales.reduce((a, s) => a.plus(d(s.totalCost)), d(0));
  const profitVal = sale.minus(cost);
  await prisma.mobileAccessoryDay.upsert({
    where: { businessMonthId_date: { businessMonthId, date } },
    create: {
      businessMonthId,
      date,
      sale: fmt(sale),
      cost: fmt(cost),
      profit: fmt(profitVal),
    },
    update: {
      sale: fmt(sale),
      cost: fmt(cost),
      profit: fmt(profitVal),
    },
  });
}

export async function rollupPartyLedger(businessMonthId: string, partyId: string) {
  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  const txs = await prisma.partyTransaction.findMany({
    where: { partyId, businessMonthId },
    orderBy: { date: "asc" },
  });
  await prisma.partyLedgerEntry.deleteMany({
    where: { businessMonthId, partyName: party.name },
  });
  for (const tx of txs) {
    const outstanding = partyOutstanding({
      materialIn: tx.materialIn,
      paymentOut: tx.paymentOut,
    });
    await prisma.partyLedgerEntry.create({
      data: {
        businessMonthId,
        date: tx.date,
        partyName: party.name,
        materialIn: tx.materialIn,
        paymentOut: tx.paymentOut,
        outstanding,
      },
    });
  }
}
