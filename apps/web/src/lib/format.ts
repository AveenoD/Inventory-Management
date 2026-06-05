import { roundMoney, sumMoney } from "@sk-mobile/shared";

export function formatMoney(value: string | number) {
  const n = roundMoney(typeof value === "string" ? parseFloat(value) : value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n || 0);
}

export function parseMoneyInput(value: string): number {
  return roundMoney(value.trim() === "" ? 0 : value);
}

export { roundMoney, sumMoney };

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
