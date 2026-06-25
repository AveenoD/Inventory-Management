"use client";

import type { ProductDto } from "@sk-mobile/shared";
import { ProductLabel, type LabelSize } from "./product-label";

export type LabelEntry = {
  product: ProductDto;
  qty: number;
};

export function ProductLabelSheet({
  entries,
  size = "48x24",
}: {
  entries: LabelEntry[];
  size?: LabelSize;
}) {
  return (
    <div className="product-label-sheet" id="product-label-print-root">
      {entries.flatMap((entry) =>
        Array.from({ length: entry.qty }, (_, i) => (
          <ProductLabel
            key={`${entry.product.id}-${i}`}
            product={entry.product}
            size={size}
          />
        )),
      )}
    </div>
  );
}
