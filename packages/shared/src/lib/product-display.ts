import { buildProductName, type ProductKind } from "../constants/inventory.js";

export type ProductDisplayFields = {
  name: string;
  kind: ProductKind;
  phoneModel?: string | null;
  coverTypeName?: string | null;
  variantName?: string | null;
  partType?: string | null;
  categoryName?: string | null;
};

/** Human-readable product title for labels and lists. */
export function getProductDisplayName(product: ProductDisplayFields): string {
  const built = buildProductName({
    kind: product.kind,
    name: product.name || undefined,
    phoneModel: product.phoneModel ?? undefined,
    coverTypeName: product.coverTypeName ?? undefined,
    variantName: product.variantName ?? undefined,
    partType: product.partType ?? undefined,
  });
  return built || product.name?.trim() || product.categoryName?.trim() || "Product";
}
