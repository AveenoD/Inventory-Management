import type { DashboardResponse } from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { d, fmt, sum } from "../lib/decimal.js";

export async function getDashboard(businessMonthId: string): Promise<DashboardResponse> {
  const month = await prisma.businessMonth.findUniqueOrThrow({
    where: { id: businessMonthId },
  });

  const [
    moneyAgg,
    rechargeAgg,
    repairAgg,
    mobileAgg,
    extraAgg,
    expenseAgg,
    damageAgg,
    withdrawalAgg,
    udhharAgg,
    partyAgg,
    bankDays,
    repairJobs,
  ] = await Promise.all([
    prisma.moneyTransferDay.aggregate({
      where: { businessMonthId },
      _sum: { total: true },
    }),
    prisma.rechargeDay.aggregate({
      where: { businessMonthId },
      _sum: { total: true },
    }),
    prisma.repairDay.aggregate({
      where: { businessMonthId },
      _sum: { sale: true, cost: true, profit: true },
    }),
    prisma.mobileAccessoryDay.aggregate({
      where: { businessMonthId },
      _sum: { sale: true, cost: true, profit: true },
    }),
    prisma.extraIncomeEntry.aggregate({
      where: { businessMonthId },
      _sum: { amount: true },
    }),
    prisma.shopExpenseDay.aggregate({
      where: { businessMonthId },
      _sum: { total: true },
    }),
    prisma.damageDay.aggregate({
      where: { businessMonthId },
      _sum: { amount: true },
    }),
    prisma.withdrawal.aggregate({
      where: { businessMonthId },
      _sum: { total: true },
    }),
    prisma.udhharDay.aggregate({
      where: { businessMonthId },
      _sum: { paymentOut: true, paymentIn: true },
    }),
    prisma.partyLedgerEntry.aggregate({
      where: { businessMonthId },
      _sum: { materialIn: true, paymentOut: true, outstanding: true },
    }),
    prisma.bankBalanceDay.findMany({
      where: { businessMonthId },
      orderBy: { date: "desc" },
      take: 1,
    }),
    prisma.repairDay.aggregate({
      where: { businessMonthId },
      _sum: { jobCount: true },
    }),
  ]);

  const openingBalance = d(month.openingBalance);
  const moneyTransferTotal = d(moneyAgg._sum.total ?? 0);
  const rechargeTotal = d(rechargeAgg._sum.total ?? 0);
  const rechargeTransferProfit = moneyTransferTotal.plus(rechargeTotal);
  const repairProfit = d(repairAgg._sum.profit ?? 0);
  const mobileProfit = d(mobileAgg._sum.profit ?? 0);
  const extraIncome = d(extraAgg._sum.amount ?? 0);
  // Excel B4 = A12+B12+C12 (extra income D12 shown separately, not in B4/F4)
  const totalIncome = rechargeTransferProfit
    .plus(repairProfit)
    .plus(mobileProfit);
  const totalExpense = d(expenseAgg._sum.total ?? 0);
  const totalWithdrawal = d(withdrawalAgg._sum.total ?? 0);
  const totalDamage = d(damageAgg._sum.amount ?? 0);
  const netProfit = openingBalance
    .plus(totalIncome)
    .minus(totalExpense)
    .minus(totalWithdrawal)
    .minus(totalDamage);

  const latestBank = bankDays[0];
  const bankBalance = d(latestBank?.total ?? 0);
  const udhharOut = d(udhharAgg._sum.paymentOut ?? 0);
  const udhharIn = d(udhharAgg._sum.paymentIn ?? 0);
  const udhharNet = udhharOut.minus(udhharIn);
  const partyOutstanding = d(partyAgg._sum.outstanding ?? 0);

  // Excel Sheet1 F7: opening + transfer/recharge profit + repair SALE + mobile SALE + extra - expenses - withdrawal - damage - bank
  const repairSaleTotal = d(repairAgg._sum.sale ?? 0);
  const mobileSaleTotal = d(mobileAgg._sum.sale ?? 0);
  const cashPortalBalance = openingBalance
    .plus(rechargeTransferProfit)
    .plus(repairSaleTotal)
    .plus(mobileSaleTotal)
    .plus(extraIncome)
    .minus(totalExpense)
    .minus(totalWithdrawal)
    .minus(totalDamage)
    .minus(bankBalance);

  const grandTotal = cashPortalBalance
    .plus(bankBalance)
    .minus(udhharNet)
    .minus(partyOutstanding);

  return {
    openingBalance: fmt(openingBalance),
    totalIncome: fmt(totalIncome),
    totalExpense: fmt(totalExpense),
    totalWithdrawal: fmt(totalWithdrawal),
    totalDamage: fmt(totalDamage),
    netProfit: fmt(netProfit),
    serviceWise: {
      rechargeTransferProfit: fmt(rechargeTransferProfit),
      repairProfit: fmt(repairProfit),
      mobileProfit: fmt(mobileProfit),
      extraIncome: fmt(extraIncome),
    },
    gross: {
      moneyTransferTotal: fmt(moneyTransferTotal),
      rechargeTotal: fmt(rechargeTotal),
      repairSale: fmt(repairSaleTotal),
      repairCost: fmt(d(repairAgg._sum.cost ?? 0)),
      mobileSale: fmt(mobileSaleTotal),
      mobileCost: fmt(d(mobileAgg._sum.cost ?? 0)),
    },
    paymentSummary: {
      cashPortalBalance: fmt(cashPortalBalance),
      bankBalance: fmt(bankBalance),
      udhharNet: fmt(udhharNet),
      partyOutstanding: fmt(partyOutstanding),
      grandTotal: fmt(grandTotal),
    },
    totals: {
      repairJobs: Number(repairJobs._sum.jobCount ?? 0),
      repairSale: fmt(repairSaleTotal),
      mobileSale: fmt(mobileSaleTotal),
    },
  };
}
