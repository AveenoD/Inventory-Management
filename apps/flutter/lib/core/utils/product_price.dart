import 'format.dart';

double productMrp(Map<String, dynamic> product) => parseMoney('${product['sellPrice']}');

double effectiveSalePrice(Map<String, dynamic> product) {
  final mrp = productMrp(product);
  final offerRaw = product['offerPrice'];
  if (offerRaw == null || '$offerRaw'.isEmpty) return mrp;
  final offer = parseMoney('$offerRaw');
  if (offer > 0 && offer < mrp) return offer;
  return mrp;
}

bool productHasDiscount(Map<String, dynamic> product) {
  final mrp = productMrp(product);
  final offer = effectiveSalePrice(product);
  return offer < mrp;
}

int productDiscountPercent(Map<String, dynamic> product) {
  final mrp = productMrp(product);
  if (mrp <= 0) return 0;
  final saved = mrp - effectiveSalePrice(product);
  if (saved <= 0) return 0;
  return ((saved / mrp) * 100).round();
}
