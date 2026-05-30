import { z } from "zod";

export const createMonthSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  openingBalance: z.coerce.number().min(0),
});

export const updateMonthSchema = z.object({
  openingBalance: z.coerce.number().min(0).optional(),
});

export type CreateMonthInput = z.infer<typeof createMonthSchema>;
export type UpdateMonthInput = z.infer<typeof updateMonthSchema>;

export type BusinessMonthDto = {
  id: string;
  year: number;
  month: number;
  openingBalance: string;
  createdAt: string;
  updatedAt: string;
};
