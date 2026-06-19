const QR_PREFIX = "SKM1:";

/** Encode product SKU for legacy QR stickers (SKM1: prefix). */
export function encodeProductQrPayload(sku: string): string {
  const code = sku.trim();
  if (!code) throw new Error("SKU required for barcode");
  return `${QR_PREFIX}${code}`;
}

/** Barcode value for stickers — raw SKU (CODE128 friendly). */
export function barcodePayloadForProduct(product: {
  sku: string | null;
  id: string;
}): string {
  const sku = product.sku?.trim();
  return sku || product.id;
}

/** Parse scanned text from USB gun or camera. */
export function parseProductScanCode(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (text.toUpperCase().startsWith(QR_PREFIX)) {
    return text.slice(QR_PREFIX.length).trim();
  }
  return text;
}
