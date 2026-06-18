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

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${ONES[h]} Hundred` : ""}${rest ? (h ? " " : "") + twoDigits(rest) : ""}`.trim();
}

function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(" ");
}

/** Indian-style amount in words for invoices (e.g. "Three Hundred Ninety Nine Rupees Only"). */
export function amountInWords(value: string | number): string {
  const n = roundMoney(typeof value === "string" ? parseFloat(value) : value);
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let words = integerToWords(rupees);
  words += rupees === 1 ? " Rupee" : " Rupees";
  if (paise > 0) {
    words += ` and ${integerToWords(paise)} ${paise === 1 ? "Paisa" : "Paise"}`;
  }
  return `${words} Only`;
}
