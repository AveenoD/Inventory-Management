import type { Product, CoverType, Category, PhoneModel } from "@prisma/client";
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
  phoneModelRef: PhoneModel | null;
};

export function mapProductDto(p: ProductWithRelations) {
  const modelName = p.phoneModelRef?.name ?? p.phoneModel;
  return {
    id: p.id,
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
    sellPrice: fmt(d(p.sellPrice)),
    stockQty: p.stockQty,
    minStock: p.minStock,
    isActive: p.isActive,
  };
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
