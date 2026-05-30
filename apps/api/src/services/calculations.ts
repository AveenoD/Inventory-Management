import { d, fmt } from "../lib/decimal.js";

type Num = string | number | { toString(): string };

export function moneyTransferTotal(row: Record<string, Num>) {
  const keys = [
    "dmt99Dmt", "dmt99Aeps", "dmt99Nepal", "dmt99BillPay", "dmt99Qr",
    "dmt86Dmt", "dmt86Aeps", "dmt86Credit", "dmt86BillPay", "dmt86Wallet",
    "dmt86Qr", "dmt86Nepal", "imeAeps", "imeNepal",
  ];
  return fmt(keys.reduce((acc, k) => acc.plus(d(row[k] ?? 0)), d(0)));
}

export function rechargeTotal(row: Record<string, Num>) {
  const keys = [
    "airtelSaleProfit", "airtelChillar", "airtelAct", "airtelMnp",
    "jioSaleProfit", "jioChillar", "jioAct", "jioMnp",
    "viSaleProfit", "viChillar", "viAct", "viMnp",
    "bsnlSaleProfit", "bsnlChillar", "bsnlAct", "bsnlMnp",
    "allInOneSaleProfit", "allInOneChillar",
  ];
  return fmt(keys.reduce((acc, k) => acc.plus(d(row[k] ?? 0)), d(0)));
}

export function profit(sale: Num, cost: Num) {
  return fmt(d(sale).minus(d(cost)));
}

export function shopExpenseTotal(row: Record<string, Num>) {
  return fmt(
    d(row.salaryAmount ?? 0).plus(d(row.teaAmount ?? 0)).plus(d(row.shopExpAmount ?? 0)),
  );
}

export function damageAmount(row: Record<string, Num>) {
  return fmt(
    d(row.accessoriesAmount ?? 0).plus(d(row.repairingAmount ?? 0)),
  );
}

export function bankTotal(row: Record<string, Num>) {
  return fmt(
    d(row.directAc ?? 0)
      .plus(d(row.salesQr ?? 0))
      .plus(d(row.transferQr ?? 0))
      .plus(d(row.cash ?? 0)),
  );
}

export function withdrawalTotal(row: Record<string, Num>) {
  return fmt(d(row.cash ?? 0).plus(d(row.bank ?? 0)));
}

export function partyOutstanding(row: Record<string, Num>) {
  return fmt(d(row.materialIn ?? 0).minus(d(row.paymentOut ?? 0)));
}

export function udhharNet(row: Record<string, Num>) {
  return fmt(d(row.paymentOut ?? 0).minus(d(row.paymentIn ?? 0)));
}
