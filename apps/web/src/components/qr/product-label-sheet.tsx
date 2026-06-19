"use client";

import type { ProductDto } from "@sk-mobile/shared";
import { ProductLabel } from "./product-label";

export function ProductLabelSheet({ products }: { products: ProductDto[] }) {
  return (
    <div className="product-label-sheet" id="product-label-print-root">
      {products.map((p) => (
        <ProductLabel key={p.id} product={p} />
      ))}
    </div>
  );
}
