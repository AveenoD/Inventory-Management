"use client";

import Barcode from "react-barcode";
import {
  barcodePayloadForProduct,
  getEffectiveSalePrice,
  type ProductDto,
} from "@sk-mobile/shared";
import { formatMoney } from "@/lib/format";

export type LabelSize = "38x21" | "48x24" | "64x34" | "100x44";

const BARCODE_CONFIG: Record<LabelSize, { width: number; height: number; nameTrunc: number }> = {
  "38x21": { width: 0.8, height: 16, nameTrunc: 20 },
  "48x24": { width: 1.0, height: 22, nameTrunc: 28 },
  "64x34": { width: 1.2, height: 30, nameTrunc: 40 },
  "100x44": { width: 1.5, height: 38, nameTrunc: 60 },
};

const SHOP_NAME = "SK MOBILE SHOP";

export function ProductLabel({
  product,
  size = "48x24",
}: {
  product: ProductDto;
  size?: LabelSize;
}) {
  const barcodeValue = barcodePayloadForProduct(product);
  const cfg = BARCODE_CONFIG[size];

  // Use short product name only (no variant/model prefix)
  const rawName = product.name?.trim() || "Product";
  const name = rawName.length > cfg.nameTrunc
    ? `${rawName.slice(0, cfg.nameTrunc - 1)}…`
    : rawName;

  const mrp = parseFloat(product.sellPrice) || 0;
  const salePrice = getEffectiveSalePrice(product);
  const hasDifferentSalePrice = salePrice < mrp;

  return (
    <div className={`product-label product-label--${size}`}>
      <div className="product-label__shop">{SHOP_NAME}</div>
      <div className="product-label__barcode">
        <Barcode
          value={barcodeValue}
          format="CODE128"
          width={cfg.width}
          height={cfg.height}
          fontSize={0}
          margin={0}
          displayValue={false}
        />
      </div>
      <div className="product-label__name">{name}</div>
      <div className="product-label__price-block">
        <span className="product-label__mrp-line">MRP-{formatMoney(product.sellPrice)}</span>
        {hasDifferentSalePrice && (
          <span className="product-label__sale-line">
            Sale Price: {formatMoney(String(salePrice))}
          </span>
        )}
      </div>
    </div>
  );
}
