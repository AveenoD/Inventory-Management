import type { Prisma, Product } from "@prisma/client";
import {
  buildProductName,
  categoryNameForKind,
  DEFAULT_COVER_TYPES,
  type PurchaseLineInput,
} from "@sk-mobile/shared";
import { d, fmt } from "../lib/decimal.js";
import { productInclude } from "./inventory-product.service.js";

type Tx = Prisma.TransactionClient;

async function resolvePhoneModelTx(
  tx: Tx,
  userId: string,
  phoneModelId?: string,
  phoneModelName?: string,
) {
  if (phoneModelId) {
    const existing = await tx.phoneModel.findFirst({
      where: { id: phoneModelId, userId },
    });
    if (existing) return existing;
  }
  const name = phoneModelName?.trim();
  if (!name) return null;
  return tx.phoneModel.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });
}

async function ensureDefaultCoverTypesTx(tx: Tx, userId: string, phoneModelId: string) {
  for (const name of DEFAULT_COVER_TYPES) {
    await tx.coverType.upsert({
      where: { userId_phoneModelId_name: { userId, phoneModelId, name } },
      create: { userId, phoneModelId, name },
      update: {},
    });
  }
}

async function resolveCoverTypeTx(
  tx: Tx,
  userId: string,
  phoneModelId: string,
  coverTypeId?: string,
  coverTypeName?: string,
) {
  if (coverTypeId) {
    const existing = await tx.coverType.findFirst({
      where: { id: coverTypeId, userId, phoneModelId },
    });
    if (existing) return existing;
  }
  const name = coverTypeName?.trim();
  if (!name) return null;
  return tx.coverType.upsert({
    where: { userId_phoneModelId_name: { userId, phoneModelId, name } },
    create: { userId, phoneModelId, name },
    update: {},
  });
}

async function findCoverProductTx(
  tx: Tx,
  userId: string,
  phoneModelId: string,
  coverTypeId: string,
  variantName: string,
) {
  return tx.product.findFirst({
    where: {
      userId,
      isActive: true,
      kind: "MOBILE_ACCESSORY",
      phoneModelId,
      coverTypeId,
      variantName,
    },
    include: productInclude,
  });
}

async function ensureCategoryForKindTx(tx: Tx, userId: string) {
  const name = categoryNameForKind("MOBILE_ACCESSORY");
  return tx.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });
}

async function createCoverProductTx(
  tx: Tx,
  userId: string,
  phoneModelId: string,
  phoneModelName: string,
  coverTypeId: string,
  coverTypeName: string,
  variantName: string,
  unitCost: string,
  sellPrice: string,
) {
  const cat = await ensureCategoryForKindTx(tx, userId);
  const name = buildProductName({
    kind: "MOBILE_ACCESSORY",
    phoneModel: phoneModelName,
    coverTypeName,
    variantName,
  });
  return tx.product.create({
    data: {
      userId,
      kind: "MOBILE_ACCESSORY",
      name,
      categoryId: cat.id,
      phoneModel: phoneModelName,
      phoneModelId,
      coverTypeId,
      variantName,
      buyPrice: unitCost,
      sellPrice,
      stockQty: 0,
      minStock: 0,
    },
    include: productInclude,
  });
}

export async function resolveProductForPurchaseLine(
  tx: Tx,
  userId: string,
  line: PurchaseLineInput,
): Promise<Product> {
  if (line.productId) {
    const product = await tx.product.findFirst({
      where: { id: line.productId, userId, isActive: true },
      include: productInclude,
    });
    if (!product) throw new Error(`Product not found: ${line.productId}`);
    return product;
  }

  const pm = await resolvePhoneModelTx(tx, userId, line.phoneModelId, line.phoneModelName);
  if (!pm) throw new Error("Phone model is required for cover purchase lines");

  await ensureDefaultCoverTypesTx(tx, userId, pm.id);
  const ct = await resolveCoverTypeTx(tx, userId, pm.id, line.coverTypeId, line.coverTypeName);
  if (!ct) throw new Error("Cover category is required for cover purchase lines");

  const variant = line.variantName?.trim();
  if (!variant) throw new Error("Design / variant name is required for cover purchase lines");

  const unitCost = fmt(d(line.unitCost));
  const sellPrice = fmt(d(line.sellPrice ?? line.unitCost));

  const existing = await findCoverProductTx(tx, userId, pm.id, ct.id, variant);
  if (existing) return existing;

  return createCoverProductTx(
    tx,
    userId,
    pm.id,
    pm.name,
    ct.id,
    ct.name,
    variant,
    unitCost,
    sellPrice,
  );
}

export async function applyPurchaseStockIn(
  tx: Tx,
  purchaseId: string,
  productId: string,
  quantity: number,
  unitCost: string,
) {
  await tx.stockMovement.create({
    data: {
      productId,
      type: "IN",
      quantity,
      unitCost,
      purchaseId,
      note: "Purchase",
    },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      stockQty: { increment: quantity },
      buyPrice: unitCost,
    },
  });
}
