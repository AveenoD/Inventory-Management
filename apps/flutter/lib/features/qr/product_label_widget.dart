import 'package:flutter/material.dart';
import 'package:barcode_widget/barcode_widget.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/format.dart';
import '../../core/utils/product_price.dart';
import '../../core/utils/product_qr.dart';

const String _shopName = 'SK MOBILE SHOP';

class ProductLabelWidget extends StatelessWidget {
  const ProductLabelWidget({super.key, required this.product, this.labelSize = LabelSize.s48x24});

  final Map<String, dynamic> product;
  final LabelSize labelSize;

  @override
  Widget build(BuildContext context) {
    final cfg = _labelConfigs[labelSize]!;
    final barcodeValue = barcodePayloadForProduct(product);

    // Use short product name only (not the full display name)
    final rawName = '${product['name'] ?? 'Product'}'.trim();
    final name = rawName.length > cfg.nameTrunc
        ? '${rawName.substring(0, cfg.nameTrunc - 1)}…'
        : rawName;

    final mrp = productMrp(product);
    final salePrice = effectiveSalePrice(product);
    final hasDifferentSalePrice = salePrice < mrp;

    return Container(
      width: cfg.widgetWidth,
      height: cfg.widgetHeight,
      padding: EdgeInsets.symmetric(horizontal: cfg.hPad, vertical: cfg.vPad),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _shopName,
            style: TextStyle(
              fontSize: cfg.shopFontSize,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: cfg.gap),
          BarcodeWidget(
            barcode: Barcode.code128(),
            data: barcodeValue,
            width: cfg.barcodeWidth,
            height: cfg.barcodeHeight,
            drawText: false,
          ),
          SizedBox(height: cfg.gap),
          Text(
            name,
            style: TextStyle(
              fontSize: cfg.nameFontSize,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          SizedBox(height: cfg.gap * 0.5),
          Text(
            'MRP-${formatMoney(mrp)}',
            style: TextStyle(
              fontSize: cfg.priceFontSize,
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
          if (hasDifferentSalePrice)
            Text(
              'Sale Price: ${formatMoney(salePrice)}',
              style: TextStyle(
                fontSize: cfg.priceFontSize,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
        ],
      ),
    );
  }
}

enum LabelSize { s38x21, s48x24, s64x34, s100x44 }

class _LabelConfig {
  const _LabelConfig({
    required this.widgetWidth,
    required this.widgetHeight,
    required this.hPad,
    required this.vPad,
    required this.gap,
    required this.shopFontSize,
    required this.nameFontSize,
    required this.priceFontSize,
    required this.barcodeWidth,
    required this.barcodeHeight,
    required this.nameTrunc,
  });

  final double widgetWidth;
  final double widgetHeight;
  final double hPad;
  final double vPad;
  final double gap;
  final double shopFontSize;
  final double nameFontSize;
  final double priceFontSize;
  final double barcodeWidth;
  final double barcodeHeight;
  final int nameTrunc;
}

const _labelConfigs = <LabelSize, _LabelConfig>{
  LabelSize.s38x21: _LabelConfig(
    widgetWidth: 144, widgetHeight: 80, hPad: 4, vPad: 3, gap: 1.5,
    shopFontSize: 7, nameFontSize: 7, priceFontSize: 6.5,
    barcodeWidth: 130, barcodeHeight: 20, nameTrunc: 20,
  ),
  LabelSize.s48x24: _LabelConfig(
    widgetWidth: 182, widgetHeight: 92, hPad: 6, vPad: 4, gap: 2,
    shopFontSize: 9, nameFontSize: 8.5, priceFontSize: 8,
    barcodeWidth: 164, barcodeHeight: 26, nameTrunc: 28,
  ),
  LabelSize.s64x34: _LabelConfig(
    widgetWidth: 242, widgetHeight: 130, hPad: 8, vPad: 6, gap: 3,
    shopFontSize: 11, nameFontSize: 10.5, priceFontSize: 10,
    barcodeWidth: 220, barcodeHeight: 34, nameTrunc: 40,
  ),
  LabelSize.s100x44: _LabelConfig(
    widgetWidth: 378, widgetHeight: 167, hPad: 12, vPad: 8, gap: 4,
    shopFontSize: 14, nameFontSize: 13, priceFontSize: 12,
    barcodeWidth: 350, barcodeHeight: 44, nameTrunc: 60,
  ),
};
