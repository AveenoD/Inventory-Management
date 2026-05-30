import { z } from "zod";

const f = z.coerce.number().min(0).default(0);

export const rechargeDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  airtelSaleProfit: f,
  airtelChillar: f,
  airtelAct: f,
  airtelMnp: f,
  jioSaleProfit: f,
  jioChillar: f,
  jioAct: f,
  jioMnp: f,
  viSaleProfit: f,
  viChillar: f,
  viAct: f,
  viMnp: f,
  bsnlSaleProfit: f,
  bsnlChillar: f,
  bsnlAct: f,
  bsnlMnp: f,
  allInOneSaleProfit: f,
  allInOneChillar: f,
});

export const bulkRechargeSchema = z.object({
  entries: z.array(rechargeDaySchema),
});

export type RechargeDayInput = z.infer<typeof rechargeDaySchema>;
