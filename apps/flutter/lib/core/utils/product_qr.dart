const _prefix = 'SKM1:';

String encodeProductQrPayload(String sku) => '$_prefix$sku';

String barcodePayloadForProduct(Map<String, dynamic> product) {
  final sku = '${product['sku'] ?? ''}'.trim();
  if (sku.isNotEmpty) return sku;
  return '${product['id']}';
}

String parseProductScanCode(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return '';
  if (text.toUpperCase().startsWith(_prefix)) {
    return text.substring(_prefix.length).trim();
  }
  return text;
}

String qrPayloadForProduct(Map<String, dynamic> product) => barcodePayloadForProduct(product);
