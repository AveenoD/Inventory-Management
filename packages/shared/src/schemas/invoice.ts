import { z } from "zod";

export const SHOP_NAME = "SK Mobile Shop";

export const updateInvoiceSettingsSchema = z.object({
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  logoDataUrl: z.string().max(600_000).optional().nullable(),
  warrantyText: z.string().max(2000).optional().nullable(),
});

export type UpdateInvoiceSettingsInput = z.infer<typeof updateInvoiceSettingsSchema>;

export type InvoiceSettingsDto = {
  shopName: typeof SHOP_NAME;
  address: string | null;
  phone: string | null;
  logoDataUrl: string | null;
  warrantyText: string | null;
};

export type SaleInvoiceDto = {
  shopName: typeof SHOP_NAME;
  address: string | null;
  phone: string | null;
  logoDataUrl: string | null;
  warrantyText: string | null;
  sale: {
    id: string;
    invoiceNo: string | null;
    date: string;
    customerName: string | null;
    paymentMethod: string;
    subtotal: string;
    discount: string;
    total: string;
    warrantyNote: string | null;
    lines: Array<{
      id: string;
      productName: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }>;
  };
};
