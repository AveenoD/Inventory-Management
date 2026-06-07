import { z } from "zod";

const money = z.coerce.number().min(0).default(0);

export const partyLedgerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyName: z.string().min(1),
  materialIn: money,
  paymentOut: money,
});

export const udhharDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentOut: money,
  paymentIn: money,
});

export const bankBalanceDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  directAc: money,
  salesQr: money,
  transferQr: money,
  cash: money,
});

export const withdrawalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  cash: money,
  bank: money,
});

export const bulkPartySchema = z.object({ entries: z.array(partyLedgerSchema).max(31) });
export const bulkUdhharSchema = z.object({ entries: z.array(udhharDaySchema).max(31) });
export const bulkBankSchema = z.object({ entries: z.array(bankBalanceDaySchema).max(31) });
export const bulkWithdrawalSchema = z.object({ entries: z.array(withdrawalSchema).max(31) });

export const createWithdrawalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
});
