String productDisplayName(Map<String, dynamic> product) {
  final kind = '${product['kind']}';
  final name = '${product['name'] ?? ''}'.trim();
  final model = '${product['phoneModel'] ?? ''}'.trim();
  final cover = '${product['coverTypeName'] ?? ''}'.trim();
  final variant = '${product['variantName'] ?? ''}'.trim();
  final part = '${product['partType'] ?? ''}'.trim();
  final category = '${product['categoryName'] ?? ''}'.trim();

  if (kind == 'MOBILE_ACCESSORY') {
    if (model.isNotEmpty && cover.isNotEmpty && variant.isNotEmpty) {
      return '$model – $cover – $variant';
    }
    if (model.isNotEmpty && cover.isNotEmpty) return '$model – $cover';
    if (name.isNotEmpty) return name;
    if (model.isNotEmpty) return model;
    return 'Accessory';
  }
  if (kind == 'REPAIR_PART') {
    if (model.isNotEmpty && part.isNotEmpty) return '$model – $part';
    if (name.isNotEmpty) return name;
    if (model.isNotEmpty) return model;
    return 'Repair part';
  }
  if (name.isNotEmpty) return name;
  if (category.isNotEmpty) return category;
  return 'Product';
}
