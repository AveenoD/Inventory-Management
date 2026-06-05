export const TRANSFER_CATEGORIES = [
  {
    id: "dmt99",
    label: "DMT 99",
    subServices: [
      { key: "dmt99Dmt", label: "DMT" },
      { key: "dmt99Aeps", label: "AEPS" },
      { key: "dmt99Nepal", label: "NEPAL" },
      { key: "dmt99BillPay", label: "BILL PAY" },
      { key: "dmt99Qr", label: "QR/UPI" },
    ],
  },
  {
    id: "dmt86",
    label: "DMT 86",
    subServices: [
      { key: "dmt86Dmt", label: "DMT" },
      { key: "dmt86Aeps", label: "AEPS" },
      { key: "dmt86Credit", label: "CREDIT" },
      { key: "dmt86BillPay", label: "BILL PAY" },
      { key: "dmt86Wallet", label: "WALLET PPI" },
      { key: "dmt86Qr", label: "QR/UPI" },
    ],
  },
  {
    id: "ime",
    label: "IME",
    subServices: [
      { key: "imeNepal", label: "NEPAL" },
      { key: "imeAeps", label: "AEPS" },
    ],
  },
] as const;

/** All valid DB keys (includes legacy dmt86Nepal for existing data) */
export const TRANSFER_SERVICE_KEYS = [
  "dmt99Dmt",
  "dmt99Aeps",
  "dmt99Nepal",
  "dmt99BillPay",
  "dmt99Qr",
  "dmt86Dmt",
  "dmt86Aeps",
  "dmt86Credit",
  "dmt86BillPay",
  "dmt86Wallet",
  "dmt86Qr",
  "dmt86Nepal",
  "imeAeps",
  "imeNepal",
] as const;

export type TransferServiceKey = (typeof TRANSFER_SERVICE_KEYS)[number];
export type TransferCategoryId = (typeof TRANSFER_CATEGORIES)[number]["id"];

/** Flat list for filters / lookups */
export const TRANSFER_SERVICES = TRANSFER_CATEGORIES.flatMap((cat) =>
  cat.subServices.map((sub) => ({
    key: sub.key,
    label: `${cat.label} — ${sub.label}`,
    categoryId: cat.id,
    categoryLabel: cat.label,
    subLabel: sub.label,
  })),
);

const LEGACY_LABELS: Record<string, string> = {
  dmt86Nepal: "DMT 86 — NEPAL",
};

export function getTransferLabel(serviceKey: string): string {
  const found = TRANSFER_SERVICES.find((s) => s.key === serviceKey);
  if (found) return found.label;
  return LEGACY_LABELS[serviceKey] ?? serviceKey;
}

export function getCategoryForKey(serviceKey: string): TransferCategoryId | null {
  for (const cat of TRANSFER_CATEGORIES) {
    if (cat.subServices.some((s) => s.key === serviceKey)) return cat.id;
  }
  if (serviceKey.startsWith("dmt99")) return "dmt99";
  if (serviceKey.startsWith("dmt86")) return "dmt86";
  if (serviceKey.startsWith("ime")) return "ime";
  return null;
}

export function getSubServicesForCategory(categoryId: TransferCategoryId) {
  const cat = TRANSFER_CATEGORIES.find((c) => c.id === categoryId);
  return cat?.subServices ?? [];
}

export function isValidTransferServiceKey(key: string): key is TransferServiceKey {
  return (TRANSFER_SERVICE_KEYS as readonly string[]).includes(key);
}
