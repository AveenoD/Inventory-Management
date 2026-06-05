/** Round to exactly 2 decimal places — prevents 119.99 / 0.76 float drift */
export function roundMoney(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Sum money values without accumulating float errors */
export function sumMoney(values: (string | number)[]): number {
  let cents = 0;
  for (const v of values) {
    const n = parseFloat(String(v));
    if (Number.isFinite(n)) cents += Math.round(n * 100);
  }
  return cents / 100;
}

/** Parse user input from a form field */
export function parseMoneyInput(value: string): number {
  return roundMoney(value.trim() === "" ? 0 : value);
}
