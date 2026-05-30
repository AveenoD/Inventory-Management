import Decimal from "decimal.js";

export function d(value: string | number | Decimal | { toString(): string }): Decimal {
  return new Decimal(value?.toString?.() ?? value ?? 0);
}

export function sum(values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(d(v)), new Decimal(0));
}

export function fmt(value: Decimal): string {
  return value.toFixed(2);
}

export function parseDate(dateStr: string): Date {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
