import 'package:flutter/material.dart';
import 'package:barcode_widget/barcode_widget.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/product_display.dart';
import '../../core/utils/format.dart';
import '../../core/utils/product_price.dart';
import '../../core/utils/product_qr.dart';

class ProductLabelWidget extends StatelessWidget {
  const ProductLabelWidget({super.key, required this.product});

  final Map<String, dynamic> product;

  @override
  Widget build(BuildContext context) {
    final name = productDisplayName(product);
    final displayName = name.length > 28 ? '${name.substring(0, 26)}…' : name;
    final sku = '${product['sku'] ?? ''}'.trim();
    final mrp = productMrp(product);
    final price = effectiveSalePrice(product);
    final hasDiscount = productHasDiscount(product);
    final pct = productDiscountPercent(product);
    final barcodeValue = barcodePayloadForProduct(product);

    return Container(
      width: 190,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            displayName,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          BarcodeWidget(
            barcode: Barcode.code128(),
            data: barcodeValue,
            width: 170,
            height: 44,
            drawText: false,
          ),
          if (sku.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              sku,
              style: const TextStyle(fontSize: 9, color: AppColors.muted, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 2),
          if (hasDiscount) ...[
            Text(
              'MRP ${formatMoney(mrp)}',
              style: const TextStyle(
                fontSize: 9,
                color: AppColors.muted,
                decoration: TextDecoration.lineThrough,
              ),
              textAlign: TextAlign.center,
            ),
            Text(
              '${formatMoney(price)}  -$pct%',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
          ] else
            Text(
              'MRP ${formatMoney(mrp)}',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
        ],
      ),
    );
  }
}
