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
  MULTI: "Multiple",
};

export function getRechargeEntryTypeLabel(entryType: string): string {
  return RECHARGE_ENTRY_TYPE_LABELS[entryType] ?? entryType;
}

export type RechargeBreakdownRow = {
  saleProfit?: string | number | null;
  chillar?: string | number | null;
  act?: string | number | null;
  mnp?: string | number | null;
  entryType?: string;
  amount?: string | number | null;
};

export function getRechargeBreakdownParts(row: RechargeBreakdownRow) {
  const hasColumns = RECHARGE_AMOUNT_FIELDS.some((f) => {
    const v = row[f.key as keyof RechargeBreakdownRow];
    return v != null;
  });

  if (hasColumns) {
    return RECHARGE_AMOUNT_FIELDS.flatMap((f) => {
      const v = row[f.key as keyof RechargeBreakdownRow];
      const n = Number(v ?? 0);
      if (n <= 0) return [];
      return [{ entryType: f.entryType, label: f.label, amount: String(n) }];
    });
  }

  if (row.entryType) {
    const n = Number(row.amount ?? 0);
    return [
      {
        entryType: row.entryType,
        label: getRechargeEntryTypeLabel(row.entryType),
        amount: String(n),
      },
    ];
  }

  return [];
}

export function formatRechargeTypeLabel(row: RechargeBreakdownRow): string {
  const parts = getRechargeBreakdownParts(row);
  return parts.map((p) => p.label).join(" + ") || "—";
}

export function rechargeEntryHasType(row: RechargeBreakdownRow, entryType: string): boolean {
  return getRechargeBreakdownParts(row).some((p) => p.entryType === entryType);
}
