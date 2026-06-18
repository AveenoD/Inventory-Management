import { SHOP_NAME, type InvoiceSettingsDto, type SaleInvoiceDto } from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { d, fmt } from "../lib/decimal.js";

export async function getOrCreateInvoiceSettings(userId: string): Promise<InvoiceSettingsDto> {
  const row = await prisma.invoiceSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return mapSettingsDto(row);
}

export async function updateInvoiceSettings(
  userId: string,
  data: {
    address?: string | null;
    phone?: string | null;
    logoDataUrl?: string | null;
    warrantyText?: string | null;
  },
): Promise<InvoiceSettingsDto> {
  const row = await prisma.invoiceSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return mapSettingsDto(row);
}

export async function allocateInvoiceNo(
  tx: Pick<typeof prisma, "invoiceSettings">,
  userId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  let settings = await tx.invoiceSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await tx.invoiceSettings.create({ data: { userId, nextInvoiceNo: 1 } });
  }
  const seq = settings.nextInvoiceNo;
  await tx.invoiceSettings.update({
    where: { userId },
    data: { nextInvoiceNo: { increment: 1 } },
  });
  return `SKM-${year}-${String(seq).padStart(5, "0")}`;
}

export async function getSaleInvoice(userId: string, saleId: string): Promise<SaleInvoiceDto | null> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, userId },
    include: { lines: { include: { product: true } } },
  });
  if (!sale) return null;

  const settings = await getOrCreateInvoiceSettings(userId);
  const subtotal = sale.lines.reduce((sum, l) => sum.plus(d(l.lineTotal)), d(0));

  return {
    shopName: SHOP_NAME,
    address: settings.address,
    phone: settings.phone,
    logoDataUrl: settings.logoDataUrl,
    warrantyText: settings.warrantyText,
    sale: {
      id: sale.id,
      invoiceNo: sale.invoiceNo,
      date: sale.date.toISOString().slice(0, 10),
      customerName: sale.customerName,
      paymentMethod: sale.paymentMethod,
      subtotal: fmt(subtotal),
      discount: fmt(d(sale.discount)),
      total: fmt(d(sale.total)),
      warrantyNote: sale.warrantyNote,
      lines: sale.lines.map((l) => ({
        id: l.id,
        productName: l.product.name,
        quantity: l.quantity,
        unitPrice: fmt(d(l.unitPrice)),
        lineTotal: fmt(d(l.lineTotal)),
      })),
    },
  };
}

function mapSettingsDto(row: {
  address: string | null;
  phone: string | null;
  logoDataUrl: string | null;
  warrantyText: string | null;
}): InvoiceSettingsDto {
  return {
    shopName: SHOP_NAME,
    address: row.address,
    phone: row.phone,
    logoDataUrl: row.logoDataUrl,
    warrantyText: row.warrantyText,
  };
}
