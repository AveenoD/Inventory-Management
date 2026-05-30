export function formatMoney(value: string | number) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
