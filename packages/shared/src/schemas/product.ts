import { z } from "zod";
import { PRODUCT_KINDS, type ProductKind } from "../constants/inventory.js";

export type { ProductKind };

export const productKindSchema = z.enum(PRODUCT_KINDS);

export const createProductSchema = z.object({
  kind: productKindSchema.default("MOBILE_ACCESSORY"),
  name: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  phoneModel: z.string().optional(),
  phoneModelId: z.string().optional(),
  variantName: z.string().optional(),
  coverTypeId: z.string().optional(),
  coverTypeName: z.string().optional(),
  partType: z.string().optional(),
  repairCharge: z.number().min(0).optional(),
  buyPrice: z.number().min(0),
  sellPrice: z.number().min(0).optional(),
  minStock: z.number().int().min(0).default(0),
  openingStock: z.number().int().min(0).default(0),
});

export const createPhoneModelSchema = z.object({
  name: z.string().min(1).max(120),
});

export const createCoverTypeSchema = z.object({
  name: z.string().min(1).max(80),
  phoneModelId: z.string().min(1),
});

export type PhoneModelDto = { id: string; name: string };

export const updateProductSchema = createProductSchema.partial();

export const stockInSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitCost: z.number().min(0).optional(),
  note: z.string().optional(),
});

export const createSaleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerName: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
  discount: z.number().min(0).default(0),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().min(0).optional(),
      }),
    )
    .min(1),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type StockInInput = z.infer<typeof stockInSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export type CoverTypeDto = { id: string; name: string; phoneModelId?: string | null };

export type ProductDto = {
  id: string;
  name: string;
  kind: ProductKind;
  categoryId: string | null;
  categoryName: string | null;
  phoneModel: string | null;
  phoneModelId: string | null;
  variantName: string | null;
  coverTypeId: string | null;
  coverTypeName: string | null;
  partType: string | null;
  repairCharge: string | null;
  buyPrice: string;
  sellPrice: string;
  stockQty: number;
  minStock: number;
  isActive: boolean;
};

export type SaleDto = {
  id: string;
  date: string;
  customerName: string | null;
  paymentMethod: string;
  subtotal: string;
  discount: string;
  total: string;
  totalCost: string;
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};
