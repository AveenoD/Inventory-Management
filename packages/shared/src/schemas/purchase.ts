import { z } from "zod";

export const purchaseLineSchema = z
  .object({
    productId: z.string().optional(),
    phoneModelId: z.string().optional(),
    phoneModelName: z.string().optional(),
    coverTypeId: z.string().optional(),
    coverTypeName: z.string().optional(),
    variantName: z.string().optional(),
    quantity: z.number().int().positive(),
    unitCost: z.number().min(0),
    sellPrice: z.number().min(0).optional(),
  })
  .superRefine((line, ctx) => {
    if (line.productId) return;
    const hasModel = !!(line.phoneModelId?.trim() || line.phoneModelName?.trim());
    const hasCover = !!(line.coverTypeId?.trim() || line.coverTypeName?.trim());
    const hasVariant = !!line.variantName?.trim();
    if (hasModel && hasCover && hasVariant) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each line needs productId or phone model + cover type + design name",
    });
  });

export const createPurchaseSchema = z.object({
  partyId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoiceNo: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  discount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "BANK"]).default("CASH"),
  lines: z.array(purchaseLineSchema).min(1),
});

export const addPurchasePaymentSchema = z.object({
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "BANK"]).optional(),
  note: z.string().max(500).optional(),
});

export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type AddPurchasePaymentInput = z.infer<typeof addPurchasePaymentSchema>;

export type PurchaseLineDto = {
  id: string;
  productId: string;
  productName: string;
  phoneModel: string | null;
  coverTypeName: string | null;
  variantName: string | null;
  quantity: number;
  unitCost: string;
  lineTotal: string;
};

export type PurchaseDto = {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  invoiceNo: string | null;
  note: string | null;
  subtotal: string;
  discount: string;
  total: string;
  paidAmount: string;
  balanceDue: string;
  paymentMethod: string;
  lines: PurchaseLineDto[];
};
