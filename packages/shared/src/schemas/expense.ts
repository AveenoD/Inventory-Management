import { z } from "zod";
import { roundMoney } from "../lib/money.js";
const money = z.coerce.number().min(0).default(0);

export const expenseCategorySchema = z.enum([
  "SALARY",
  "TEA",
  "SHOP",
  "ACCESSORIES_DAMAGE",
  "REPAIRING_DAMAGE",
]);

export const createExpenseEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: expenseCategorySchema,
  amount: z.coerce.number().positive().transform(roundMoney),
  description: z.string().optional(),
});

export const updateExpenseEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: expenseCategorySchema,
  amount: z.coerce.number().min(0).transform(roundMoney),
  description: z.string().optional(),
});

export const deleteExpenseEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: expenseCategorySchema,
});

export const shopExpenseDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salaryDescription: z.string().optional(),
  salaryAmount: money,
  teaDescription: z.string().optional(),
  teaAmount: money,
  shopExpDescription: z.string().optional(),
  shopExpAmount: money,
});

export const damageDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accessoriesDescription: z.string().optional(),
  accessoriesAmount: money,
  repairingDescription: z.string().optional(),
  repairingAmount: money,
});

export const bulkShopExpenseSchema = z.object({ entries: z.array(shopExpenseDaySchema).max(31) });
export const bulkDamageSchema = z.object({ entries: z.array(damageDaySchema).max(31) });
