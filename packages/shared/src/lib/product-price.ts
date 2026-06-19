/** Product with MRP (sellPrice) and optional offer/discount price. */
export type ProductPricing = {
  sellPrice: string | number;
  offerPrice?: string | number | null;
};

function toNum(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Customer-facing sale price: offer if valid and below MRP, else MRP. */
export function getEffectiveSalePrice(product: ProductPricing): number {
  const mrp = toNum(product.sellPrice);
  const offer = product.offerPrice != null && product.offerPrice !== "" ? toNum(product.offerPrice) : null;
  if (offer != null && offer > 0 && offer < mrp) return offer;
  return mrp;
}

export function getProductMrp(product: ProductPricing): number {
  return toNum(product.sellPrice);
}

export type ProductDiscount = {
  amount: number;
  percent: number;
  hasDiscount: boolean;
};

export function getProductDiscount(product: ProductPricing): ProductDiscount {
  const mrp = getProductMrp(product);
  const effective = getEffectiveSalePrice(product);
  const amount = Math.max(0, mrp - effective);
  const percent = mrp > 0 ? Math.round((amount / mrp) * 100) : 0;
  return {
    amount,
    percent,
    hasDiscount: amount > 0,
  };
}
