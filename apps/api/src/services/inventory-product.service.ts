import type { Product, CoverType, Category, PhoneModel } from "@prisma/client";
import {
  buildProductName,
  categoryNameForKind,
  DEFAULT_COVER_TYPES,
  getEffectiveSalePrice,
  type ProductKind,
} from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { d, fmt } from "../lib/decimal.js";

type ProductWithRelations = Product & {
  category: Category | null;
  coverType: CoverType | null;
  phoneModelRef: PhoneModel | null;
};

export function mapProductDto(p: ProductWithRelations) {
  const modelName = p.phoneModelRef?.name ?? p.phoneModel;
  const sellPrice = fmt(d(p.sellPrice));
  const offerPrice = p.offerPrice != null ? fmt(d(p.offerPrice)) : null;
  const effective = fmt(d(getEffectiveSalePrice({ sellPrice, offerPrice })));
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    kind: p.kind as ProductKind,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? categoryNameForKind(p.kind as ProductKind),
    phoneModel: modelName,
    phoneModelId: p.phoneModelId,
    variantName: p.variantName,
    coverTypeId: p.coverTypeId,
    coverTypeName: p.coverType?.name ?? null,
    partType: p.partType,
    repairCharge: p.repairCharge != null ? fmt(d(p.repairCharge)) : null,
    buyPrice: fmt(d(p.buyPrice)),
    sellPrice,
    offerPrice,
    effectivePrice: effective,
    stockQty: p.stockQty,
    minStock: p.minStock,
    isActive: p.isActive,
  };
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function allocateProductSku(userId: string, tx?: PrismaTx): Promise<string> {
  const client = tx ?? prisma;
  const existing = await client.product.findMany({
    where: { userId, sku: { not: null } },
    select: { sku: true },
  });
  let max = 0;
  for (const row of existing) {
    const m = row.sku?.match(/^SK-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  for (let seq = max + 1; seq < max + 100000; seq++) {
    const sku = `SK-${String(seq).padStart(6, "0")}`;
    const taken = await client.product.findFirst({ where: { userId, sku } });
    if (!taken) return sku;
  }
  throw new Error("Could not allocate product SKU");
}

export async function findProductByScanCode(userId: string, rawCode: string) {
  const code = rawCode.trim();
  if (!code) return null;
  const bySku = await prisma.product.findFirst({
    where: {
      userId,
      isActive: true,
      sku: { equals: code, mode: "insensitive" },
    },
    include: productInclude,
  });
  if (bySku) return bySku;
  return prisma.product.findFirst({
    where: { userId, isActive: true, id: code },
    include: productInclude,
  });
}

export async function ensureDefaultCoverTypesForPhoneModel(userId: string, phoneModelId: string) {
  for (const name of DEFAULT_COVER_TYPES) {
    await prisma.coverType.upsert({
      where: {
        userId_phoneModelId_name: { userId, phoneModelId, name },
      },
      create: { userId, phoneModelId, name },
      update: {},
    });
  }
}

export async function resolvePhoneModel(userId: string, phoneModelId?: string, phoneModelName?: string) {
  if (phoneModelId) {
    const existing = await prisma.phoneModel.findFirst({
      where: { id: phoneModelId, userId },
    });
    if (existing) return existing;
  }
  const name = phoneModelName?.trim();
  if (!name) return null;
  return prisma.phoneModel.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });
}

export async function resolveCoverType(
  userId: string,
  phoneModelId: string,
  coverTypeId?: string,
  coverTypeName?: string,
) {
  if (coverTypeId) {
    const existing = await prisma.coverType.findFirst({
      where: { id: coverTypeId, userId, phoneModelId },
    });
    if (existing) return existing;
  }
  const name = coverTypeName?.trim();
  if (!name) return null;
  return prisma.coverType.upsert({
    where: {
      userId_phoneModelId_name: { userId, phoneModelId, name },
    },
    create: { userId, phoneModelId, name },
    update: {},
  });
}

export async function ensureCategoryForKind(userId: string, kind: ProductKind) {
  const name = categoryNameForKind(kind);
  return prisma.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });
}

export const productInclude = {
  category: true,
  coverType: true,
  phoneModelRef: true,
} as const;
