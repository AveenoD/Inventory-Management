import { z } from "zod";

const money = z.coerce.number().min(0).default(0);

export const repairDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jobCount: z.coerce.number().int().min(0).default(0),
  sale: money,
  cost: money,
});

export const mobileAccessoryDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sale: money,
  cost: money,
});

export const extraIncomeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  amount: money,
});

export const bulkRepairSchema = z.object({ entries: z.array(repairDaySchema).max(31) });
export const bulkMobileSchema = z.object({ entries: z.array(mobileAccessoryDaySchema).max(31) });
export const bulkExtraIncomeSchema = z.object({ entries: z.array(extraIncomeSchema).max(31) });
