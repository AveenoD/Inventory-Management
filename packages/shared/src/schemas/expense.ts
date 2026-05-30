import { z } from "zod";

const money = z.coerce.number().min(0).default(0);

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

export const bulkShopExpenseSchema = z.object({ entries: z.array(shopExpenseDaySchema) });
export const bulkDamageSchema = z.object({ entries: z.array(damageDaySchema) });
