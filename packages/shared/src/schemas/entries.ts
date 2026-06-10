import { z } from "zod";
import { TRANSFER_SERVICE_KEYS } from "../constants/money-transfer.js";
import { roundMoney } from "../lib/money.js";

const moneyAmount = z.coerce.number().transform(roundMoney);

export const rechargeEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  operator: z.enum(["AIRTEL", "JIO", "VI", "BSNL", "ALL_IN_ONE"]),
  entryType: z.enum(["SALE_PROFIT", "CHILLAR", "ACT", "MNP"]),
  amount: moneyAmount,
  note: z.string().optional(),
});

/** One recharge form — face value + all profit types at once (profit empty = 0) */
export const rechargeBatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  operator: z.enum(["AIRTEL", "JIO", "VI", "BSNL", "ALL_IN_ONE"]),
  rechargeAmount: moneyAmount.default(0),
  saleProfit: moneyAmount.default(0),
  chillar: moneyAmount.default(0),
  act: moneyAmount.default(0),
  mnp: moneyAmount.default(0),
});

export const transferEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceKey: z.enum(TRANSFER_SERVICE_KEYS),
  amount: moneyAmount,
  note: z.string().optional(),
});

export const repairIntakeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  device: z.string().min(1),
  issueDescription: z.string().min(1),
  repairCost: moneyAmount.default(0),
  customerCharge: moneyAmount.default(0),
  note: z.string().optional(),
});

export const repairJobSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerName: z.string().optional(),
  device: z.string().optional(),
  partsCost: moneyAmount.default(0),
  labourCost: moneyAmount.default(0),
  salePrice: moneyAmount,
  note: z.string().optional(),
});

export const repairPartUsedSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
});

export const updateRepairJobSchema = z.object({
  status: z.enum([
    "RECEIVED",
    "IN_PROGRESS",
    "REPAIRED_PENDING_PICKUP",
    "DELIVERED",
    "UNREPAIRABLE_RETURNED",
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional(),
  device: z.string().min(1).optional(),
  issueDescription: z.string().min(1).optional(),
  repairCost: moneyAmount.optional(),
  customerCharge: moneyAmount.optional(),
  partsCost: moneyAmount.optional(),
  labourCost: moneyAmount.optional(),
  salePrice: moneyAmount.optional(),
  /** Inventory repair parts consumed; empty array = none */
  partsUsed: z.array(repairPartUsedSchema).optional(),
  /** Part sourced outside inventory (ordered on demand) */
  otherPartUsed: z.string().min(1).optional(),
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
  otherPartUsed: string | null;
  partsUsed: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitCost: string;
  }>;
};

export const partySchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});

export const partyTransactionSchema = z.object({
  partyId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  materialIn: moneyAmount.default(0),
  paymentOut: moneyAmount.default(0),
  note: z.string().optional(),
});

export type RechargeEntryInput = z.infer<typeof rechargeEntrySchema>;
export type RechargeBatchInput = z.infer<typeof rechargeBatchSchema>;
export type TransferEntryInput = z.infer<typeof transferEntrySchema>;
export type RepairIntakeInput = z.infer<typeof repairIntakeSchema>;
export type RepairJobInput = z.infer<typeof repairJobSchema>;
export type UpdateRepairJobInput = z.infer<typeof updateRepairJobSchema>;
export type PartyInput = z.infer<typeof partySchema>;
export type PartyTransactionInput = z.infer<typeof partyTransactionSchema>;

export {
  TRANSFER_CATEGORIES,
  TRANSFER_SERVICES,
  TRANSFER_SERVICE_KEYS,
  getTransferLabel,
  getCategoryForKey,
  getSubServicesForCategory,
  isValidTransferServiceKey,
} from "../constants/money-transfer.js";
