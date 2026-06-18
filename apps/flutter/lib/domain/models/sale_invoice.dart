const kShopName = 'SK Mobile Shop';

class SaleInvoiceLine {
  SaleInvoiceLine({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  factory SaleInvoiceLine.fromJson(Map<String, dynamic> json) => SaleInvoiceLine(
        id: '${json['id']}',
        productName: '${json['productName']}',
        quantity: json['quantity'] as int? ?? 0,
        unitPrice: '${json['unitPrice']}',
        lineTotal: '${json['lineTotal']}',
      );

  final String id;
  final String productName;
  final int quantity;
  final String unitPrice;
  final String lineTotal;
}

class SaleInvoiceSale {
  SaleInvoiceSale({
    required this.id,
    required this.invoiceNo,
    required this.date,
    required this.customerName,
    required this.paymentMethod,
    required this.subtotal,
    required this.discount,
    required this.total,
    required this.warrantyNote,
    required this.lines,
  });

  factory SaleInvoiceSale.fromJson(Map<String, dynamic> json) => SaleInvoiceSale(
        id: '${json['id']}',
        invoiceNo: json['invoiceNo'] as String?,
        date: '${json['date']}',
        customerName: json['customerName'] as String?,
        paymentMethod: '${json['paymentMethod']}',
        subtotal: '${json['subtotal']}',
        discount: '${json['discount']}',
        total: '${json['total']}',
        warrantyNote: json['warrantyNote'] as String?,
        lines: (json['lines'] as List<dynamic>? ?? [])
            .map((e) => SaleInvoiceLine.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final String id;
  final String? invoiceNo;
  final String date;
  final String? customerName;
  final String paymentMethod;
  final String subtotal;
  final String discount;
  final String total;
  final String? warrantyNote;
  final List<SaleInvoiceLine> lines;
}

class SaleInvoiceData {
  SaleInvoiceData({
    required this.shopName,
    required this.address,
    required this.phone,
    required this.logoDataUrl,
    required this.warrantyText,
    required this.sale,
  });

  factory SaleInvoiceData.fromJson(Map<String, dynamic> json) => SaleInvoiceData(
        shopName: '${json['shopName']}',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
        logoDataUrl: json['logoDataUrl'] as String?,
        warrantyText: json['warrantyText'] as String?,
        sale: SaleInvoiceSale.fromJson(json['sale'] as Map<String, dynamic>),
      );

  final String shopName;
  final String? address;
  final String? phone;
  final String? logoDataUrl;
  final String? warrantyText;
  final SaleInvoiceSale sale;

  String? get warrantyBody {
    final saleNote = sale.warrantyNote?.trim();
    if (saleNote != null && saleNote.isNotEmpty) return saleNote;
    final defaultNote = warrantyText?.trim();
    if (defaultNote != null && defaultNote.isNotEmpty) return defaultNote;
    return null;
  }
}

class InvoiceSettings {
  InvoiceSettings({
    required this.shopName,
    required this.address,
    required this.phone,
    required this.logoDataUrl,
    required this.warrantyText,
  });

  factory InvoiceSettings.fromJson(Map<String, dynamic> json) => InvoiceSettings(
        shopName: '${json['shopName']}',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
        logoDataUrl: json['logoDataUrl'] as String?,
        warrantyText: json['warrantyText'] as String?,
      );

  final String shopName;
  final String? address;
  final String? phone;
  final String? logoDataUrl;
  final String? warrantyText;

  Map<String, dynamic> toUpdateJson({
    String? address,
    String? phone,
    String? logoDataUrl,
    String? warrantyText,
  }) =>
      {
        'address': address,
        'phone': phone,
        if (logoDataUrl != null) 'logoDataUrl': logoDataUrl,
        'warrantyText': warrantyText,
      };
}
