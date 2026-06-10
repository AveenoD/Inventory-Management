export const EXPENSE_CATEGORIES = [
  { key: "SALARY", label: "Salary", group: "SHOP_EXPENSE" as const },
  { key: "TEA", label: "Tea & Refreshments", group: "SHOP_EXPENSE" as const },
  { key: "SHOP", label: "Shop Expense", group: "SHOP_EXPENSE" as const },
  { key: "ACCESSORIES_DAMAGE", label: "Accessories Damage", group: "DAMAGE" as const },
  { key: "REPAIRING_DAMAGE", label: "Repairing Damage", group: "DAMAGE" as const },
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number]["key"];

export function getExpenseCategoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function getExpenseCategoryGroup(key: ExpenseCategoryKey): "SHOP_EXPENSE" | "DAMAGE" {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)!.group;
}

export type ExpenseLineCategory = "SHOP_EXPENSE" | "DAMAGE" | "WITHDRAWAL";

export type ExpenseLineItem = {
  id: string;
  date: string;
  categoryKey: ExpenseCategoryKey | "WITHDRAWAL";
  lineCategory: ExpenseLineCategory;
  type: string;
  description: string;
  amount: number;
  paymentMethod: string;
  withdrawalId?: string;
};

function num(v: unknown) {
  return Number(v ?? 0) || 0;
}

export function buildExpenseLineItems(
  shopDays: Array<Record<string, unknown>>,
  damageDays: Array<Record<string, unknown>>,
  withdrawals: Array<Record<string, unknown>>,
): ExpenseLineItem[] {
  const rows: ExpenseLineItem[] = [];

  for (const d of shopDays) {
    const date = String(d.date ?? "");
    const pairs: Array<[ExpenseCategoryKey, string, string]> = [
      ["SALARY", "salaryAmount", "salaryDescription"],
      ["TEA", "teaAmount", "teaDescription"],
      ["SHOP", "shopExpAmount", "shopExpDescription"],
    ];
    for (const [key, amtKey, descKey] of pairs) {
      const amount = num(d[amtKey]);
      const desc = String(d[descKey] ?? "").trim();
      if (amount > 0 || desc) {
        rows.push({
          id: `exp-${date}-${key}`,
          date,
          categoryKey: key,
          lineCategory: "SHOP_EXPENSE",
          type: getExpenseCategoryLabel(key),
          description: desc || getExpenseCategoryLabel(key),
          amount,
          paymentMethod: "Cash",
        });
      }
    }
  }

  for (const d of damageDays) {
    const date = String(d.date ?? "");
    const pairs: Array<[ExpenseCategoryKey, string, string]> = [
      ["ACCESSORIES_DAMAGE", "accessoriesAmount", "accessoriesDescription"],
      ["REPAIRING_DAMAGE", "repairingAmount", "repairingDescription"],
    ];
    for (const [key, amtKey, descKey] of pairs) {
      const amount = num(d[amtKey]);
      const desc = String(d[descKey] ?? "").trim();
      if (amount > 0 || desc) {
        rows.push({
          id: `exp-${date}-${key}`,
          date,
          categoryKey: key,
          lineCategory: "DAMAGE",
          type: getExpenseCategoryLabel(key),
          description: desc || getExpenseCategoryLabel(key),
          amount,
          paymentMethod: "—",
        });
      }
    }
  }

  for (const w of withdrawals) {
    const amount = num(w.total);
    if (amount <= 0) continue;
    const id = String(w.id ?? "");
    const date = String(w.date ?? "");
    rows.push({
      id: id ? `wd-${id}` : `wd-${date}-${amount}`,
      date,
      categoryKey: "WITHDRAWAL",
      lineCategory: "WITHDRAWAL",
      type: "Withdraw",
      description: String(w.description ?? "").trim() || "Withdrawal from profit",
      amount,
      paymentMethod: num(w.bank) > 0 ? "Bank" : "Cash",
      withdrawalId: id || undefined,
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
  return rows;
}
