import { z } from "zod";

export const rechargeEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  operator: z.enum(["AIRTEL", "JIO", "VI", "BSNL", "ALL_IN_ONE"]),
  entryType: z.enum(["SALE_PROFIT", "CHILLAR", "ACT", "MNP"]),
  amount: z.number(),
  note: z.string().optional(),
});

export const transferEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceKey: z.string().min(1),
  amount: z.number(),
  note: z.string().optional(),
});

export const repairIntakeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  device: z.string().min(1),
  issueDescription: z.string().min(1),
  /** Shop cost (parts + labour combined) */
  repairCost: z.number().min(0).default(0),
  /** Amount customer will pay */
  customerCharge: z.number().min(0).default(0),
  note: z.string().optional(),
});

export const repairJobSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerName: z.string().optional(),
  device: z.string().optional(),
  partsCost: z.number().min(0).default(0),
  labourCost: z.number().min(0).default(0),
  salePrice: z.number().min(0),
  note: z.string().optional(),
});

export const updateRepairJobSchema = z.object({
  status: z.enum([
    "RECEIVED",
    "IN_PROGRESS",
    "REPAIRED_PENDING_PICKUP",
    "DELIVERED",
    "UNREPAIRABLE_RETURNED",
  ]),
  repairCost: z.number().min(0).optional(),
  customerCharge: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  labourCost: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  deliveredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().optional(),
});

export type RepairJobDto = {
  id: string;
  date: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  device: string | null;
  issueDescription: string | null;
  repairCost: string;
  customerCharge: string;
  partsCost: string;
  labourCost: string;
  salePrice: string;
  profit: string;
  deliveredAt: string | null;
  note: string | null;
};

export const partySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});

export const partyTransactionSchema = z.object({
  partyId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  materialIn: z.number().min(0).default(0),
  paymentOut: z.number().min(0).default(0),
  note: z.string().optional(),
});

export type RechargeEntryInput = z.infer<typeof rechargeEntrySchema>;
export type TransferEntryInput = z.infer<typeof transferEntrySchema>;
export type RepairIntakeInput = z.infer<typeof repairIntakeSchema>;
export type RepairJobInput = z.infer<typeof repairJobSchema>;
export type UpdateRepairJobInput = z.infer<typeof updateRepairJobSchema>;
export type PartyInput = z.infer<typeof partySchema>;
export type PartyTransactionInput = z.infer<typeof partyTransactionSchema>;

export const TRANSFER_SERVICES = [
  { key: "dmt99Dmt", label: "DMT99 DMT" },
  { key: "dmt99Aeps", label: "DMT99 AEPS" },
  { key: "dmt99Nepal", label: "DMT99 Nepal" },
  { key: "dmt99BillPay", label: "DMT99 Bill Pay" },
  { key: "dmt99Qr", label: "DMT99 QR" },
  { key: "dmt86Dmt", label: "DMT86 DMT" },
  { key: "dmt86Aeps", label: "DMT86 AEPS" },
  { key: "dmt86Credit", label: "DMT86 Credit" },
  { key: "dmt86BillPay", label: "DMT86 Bill Pay" },
  { key: "dmt86Wallet", label: "DMT86 Wallet" },
  { key: "dmt86Qr", label: "DMT86 QR" },
  { key: "dmt86Nepal", label: "DMT86 Nepal" },
  { key: "imeAeps", label: "IME AEPS" },
  { key: "imeNepal", label: "IME Nepal" },
] as const;
