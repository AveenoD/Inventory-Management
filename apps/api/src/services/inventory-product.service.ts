import type { Product, CoverType, Category } from "@prisma/client";
import {
  buildProductName,
  categoryNameForKind,
  DEFAULT_COVER_TYPES,
  type ProductKind,
} from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";
import { d, fmt } from "../lib/decimal.js";

type ProductWithRelations = Product & {
  category: Category | null;
  coverType: CoverType | null;
};

export function mapProductDto(p: ProductWithRelations) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    kind: p.kind as ProductKind,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? categoryNameForKind(p.kind as ProductKind),
    phoneModel: p.phoneModel,
    coverTypeId: p.coverTypeId,
    coverTypeName: p.coverType?.name ?? null,
    partType: p.partType,
    repairCharge: p.repairCharge != null ? fmt(d(p.repairCharge)) : null,
    buyPrice: fmt(d(p.buyPrice)),
    sellPrice: fmt(d(p.sellPrice)),
    stockQty: p.stockQty,
    minStock: p.minStock,
    isActive: p.isActive,
  };
}

export async function ensureDefaultCoverTypes(userId: string) {
  for (const name of DEFAULT_COVER_TYPES) {
    await prisma.coverType.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
    });
  }
}

export async function resolveCoverType(
  userId: string,
  coverTypeId?: string,
  coverTypeName?: string,
) {
  if (coverTypeId) {
    const existing = await prisma.coverType.findFirst({
      where: { id: coverTypeId, userId },
    });
    if (existing) return existing;
  }
  const name = coverTypeName?.trim();
  if (!name) return null;
  return prisma.coverType.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
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
