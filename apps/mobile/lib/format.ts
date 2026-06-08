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

export function formatDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
