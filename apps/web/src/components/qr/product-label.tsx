"use client";

import Barcode from "react-barcode";
import {
  barcodePayloadForProduct,
  getEffectiveSalePrice,
  getProductDiscount,
  getProductDisplayName,
  type ProductDto,
} from "@sk-mobile/shared";
import { formatMoney } from "@/lib/format";

export function ProductLabel({ product }: { product: ProductDto }) {
  const discount = getProductDiscount(product);
  const barcodeValue = barcodePayloadForProduct(product);
  const displayName = getProductDisplayName(product);
  const name = displayName.length > 28 ? `${displayName.slice(0, 26)}…` : displayName;
  const salePrice = formatMoney(getEffectiveSalePrice(product));

  return (
    <div className="product-label">
      <div className="product-label__name">{name}</div>
      <div className="product-label__barcode">
        <Barcode
          value={barcodeValue}
          format="CODE128"
          width={1.1}
          height={32}
          fontSize={0}
          margin={0}
          displayValue={false}
        />
      </div>
      <div className="product-label__meta">
        {product.sku ? <div className="product-label__sku">{product.sku}</div> : null}
        {discount.hasDiscount ? (
          <div className="product-label__prices">
            <span className="product-label__mrp strike">
              MRP {formatMoney(product.sellPrice)}
            </span>
            <span className="product-label__offer">
              {salePrice}
              <span className="product-label__off"> -{discount.percent}%</span>
            </span>
          </div>
        ) : (
          <div className="product-label__offer">MRP {salePrice}</div>
        )}
      </div>
    </div>
  );
}
