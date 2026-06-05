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
