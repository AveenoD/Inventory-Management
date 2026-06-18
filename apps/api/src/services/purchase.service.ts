import type { Purchase, PurchaseLine, Party, Product, CoverType, PhoneModel } from "@prisma/client";
import type { AddPurchasePaymentInput, CreatePurchaseInput, PurchaseDto } from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { d, fmt } from "../lib/decimal.js";
import { resolveMonthForDate } from "./month-resolver.js";
import { rollupPartyLedger } from "./rollup.service.js";
import {
  applyPurchaseStockIn,
  resolveProductForPurchaseLine,
} from "./purchase-product.service.js";
import { productInclude } from "./inventory-product.service.js";

type PurchaseWithRelations = Purchase & {
  party: Party;
  lines: Array<
    PurchaseLine & {
      product: Product & {
        coverType: CoverType | null;
        phoneModelRef: PhoneModel | null;
      };
    }
  >;
};

function parseDate(s: string) {
  return new Date(`${s}T00:00:00.000Z`);
}

export function mapPurchaseDto(p: PurchaseWithRelations): PurchaseDto {
  const total = d(p.total);
  const paid = d(p.paidAmount);
  return {
    id: p.id,
    date: p.date.toISOString().slice(0, 10),
    partyId: p.partyId,
    partyName: p.party.name,
    invoiceNo: p.invoiceNo,
    note: p.note,
    subtotal: fmt(d(p.subtotal)),
    discount: fmt(d(p.discount)),
    total: fmt(total),
    paidAmount: fmt(paid),
    balanceDue: fmt(total.minus(paid)),
    paymentMethod: p.paymentMethod,
    lines: p.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.product.name,
      phoneModel: line.product.phoneModelRef?.name ?? line.product.phoneModel,
      coverTypeName: line.product.coverType?.name ?? null,
      variantName: line.product.variantName,
      quantity: line.quantity,
      unitCost: fmt(d(line.unitCost)),
      lineTotal: fmt(d(line.lineTotal)),
    })),
  };
}

const purchaseInclude = {
  party: true,
  lines: {
    include: {
      product: { include: productInclude },
    },
  },
} as const;

export async function createPurchase(userId: string, body: CreatePurchaseInput): Promise<PurchaseDto> {
  const date = parseDate(body.date);
  const month = await resolveMonthForDate(userId, date);

  const party = await prisma.party.findFirst({
    where: { id: body.partyId, userId },
  });
  if (!party) throw new Error("Supplier not found");

  const purchase = await prisma.$transaction(async (tx) => {
    let subtotal = d(0);
    const lineData: Array<{
      productId: string;
      quantity: number;
      unitCost: string;
      lineTotal: string;
    }> = [];

    for (const line of body.lines) {
      const product = await resolveProductForPurchaseLine(tx, userId, line);
      const unitCost = d(line.unitCost);
      const lineTotal = unitCost.times(line.quantity);
      subtotal = subtotal.plus(lineTotal);
      lineData.push({
        productId: product.id,
        quantity: line.quantity,
        unitCost: fmt(unitCost),
        lineTotal: fmt(lineTotal),
      });
    }

    const discount = d(body.discount ?? 0);
    if (discount.gt(subtotal)) {
      throw new Error("Discount cannot exceed subtotal");
    }
    const total = subtotal.minus(discount);
    const paidAmount = d(body.paidAmount ?? 0);
    if (paidAmount.gt(total)) {
      throw new Error("Paid amount cannot exceed purchase total");
    }

    const created = await tx.purchase.create({
      data: {
        userId,
        businessMonthId: month.id,
        partyId: body.partyId,
        date,
        invoiceNo: body.invoiceNo?.trim() || null,
        note: body.note?.trim() || null,
        subtotal: fmt(subtotal),
        discount: fmt(discount),
        total: fmt(total),
        paidAmount: fmt(paidAmount),
        paymentMethod: body.paymentMethod,
      },
    });

    for (const ld of lineData) {
      await tx.purchaseLine.create({
        data: { purchaseId: created.id, ...ld },
      });
      await applyPurchaseStockIn(tx, created.id, ld.productId, ld.quantity, ld.unitCost);
    }

    const invoiceRef = body.invoiceNo?.trim() ? ` (${body.invoiceNo.trim()})` : "";
    await tx.partyTransaction.create({
      data: {
        partyId: body.partyId,
        businessMonthId: month.id,
        date,
        materialIn: fmt(total),
        paymentOut: fmt(paidAmount),
        note: `Purchase${invoiceRef}`,
        purchaseId: created.id,
      },
    });

    return tx.purchase.findFirstOrThrow({
      where: { id: created.id },
      include: purchaseInclude,
    });
  });

  await rollupPartyLedger(purchase.businessMonthId, purchase.partyId);
  return mapPurchaseDto(purchase);
}

export async function addPurchasePayment(
  userId: string,
  purchaseId: string,
  body: AddPurchasePaymentInput,
): Promise<PurchaseDto> {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
    include: purchaseInclude,
  });
  if (!purchase) throw new Error("Purchase not found");

  const total = d(purchase.total);
  const currentPaid = d(purchase.paidAmount);
  const payment = d(body.amount);
  const newPaid = currentPaid.plus(payment);
  if (newPaid.gt(total)) {
    throw new Error("Payment exceeds remaining balance");
  }

  const payDate = body.date ? parseDate(body.date) : purchase.date;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { paidAmount: fmt(newPaid) },
    });

    await tx.partyTransaction.create({
      data: {
        partyId: purchase.partyId,
        businessMonthId: purchase.businessMonthId,
        date: payDate,
        materialIn: fmt(d(0)),
        paymentOut: fmt(payment),
        note: body.note?.trim() || `Payment for purchase ${purchase.id.slice(-6)}`,
      },
    });

    return tx.purchase.findFirstOrThrow({
      where: { id: purchase.id },
      include: purchaseInclude,
    });
  });

  await rollupPartyLedger(updated.businessMonthId, updated.partyId);
  return mapPurchaseDto(updated);
}

export async function getPurchaseById(userId: string, purchaseId: string): Promise<PurchaseDto | null> {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
    include: purchaseInclude,
  });
  return purchase ? mapPurchaseDto(purchase) : null;
}

export async function listPurchases(
  userId: string,
  opts: { page: number; limit: number; date?: string; partyId?: string },
) {
  const where = {
    userId,
    ...(opts.date && { date: parseDate(opts.date) }),
    ...(opts.partyId && { partyId: opts.partyId }),
  };
  const total = await prisma.purchase.count({ where });
  const skip = (opts.page - 1) * opts.limit;
  const rows = await prisma.purchase.findMany({
    where,
    include: purchaseInclude,
    orderBy: { createdAt: "desc" },
    skip,
    take: opts.limit,
  });
  const totalPages = Math.max(1, Math.ceil(total / opts.limit));
  return {
    data: rows.map(mapPurchaseDto),
    meta: { page: opts.page, limit: opts.limit, total, totalPages },
  };
}
