export const RECHARGE_OPERATORS = [
  "AIRTEL",
  "JIO",
  "VI",
  "BSNL",
  "ALL_IN_ONE",
] as const;

export type RechargeOperator = (typeof RECHARGE_OPERATORS)[number];

export const RECHARGE_AMOUNT_FIELDS = [
  { key: "saleProfit", entryType: "SALE_PROFIT", label: "Sale Profit" },
  { key: "chillar", entryType: "CHILLAR", label: "Chillar" },
  { key: "act", entryType: "ACT", label: "ACT" },
  { key: "mnp", entryType: "MNP", label: "MNP" },
] as const;

export type RechargeAmountFieldKey = (typeof RECHARGE_AMOUNT_FIELDS)[number]["key"];

export const RECHARGE_ENTRY_TYPE_LABELS: Record<string, string> = {
  SALE_PROFIT: "Sale Profit",
  CHILLAR: "Chillar",
  ACT: "ACT",
  MNP: "MNP",
};

export function getRechargeEntryTypeLabel(entryType: string): string {
  return RECHARGE_ENTRY_TYPE_LABELS[entryType] ?? entryType;
}
