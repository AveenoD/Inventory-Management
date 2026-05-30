import { z } from "zod";

const moneyField = z.coerce.number().min(0).default(0);

export const moneyTransferDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dmt99Dmt: moneyField,
  dmt99Aeps: moneyField,
  dmt99Nepal: moneyField,
  dmt99BillPay: moneyField,
  dmt99Qr: moneyField,
  dmt86Dmt: moneyField,
  dmt86Aeps: moneyField,
  dmt86Credit: moneyField,
  dmt86BillPay: moneyField,
  dmt86Wallet: moneyField,
  dmt86Qr: moneyField,
  dmt86Nepal: moneyField,
  imeAeps: moneyField,
  imeNepal: moneyField,
});

export const bulkMoneyTransferSchema = z.object({
  entries: z.array(moneyTransferDaySchema),
});

export type MoneyTransferDayInput = z.infer<typeof moneyTransferDaySchema>;
