class TransferSubService {
  const TransferSubService({required this.key, required this.label});
  final String key;
  final String label;
}

class TransferCategory {
  const TransferCategory({
    required this.id,
    required this.label,
    required this.subServices,
  });
  final String id;
  final String label;
  final List<TransferSubService> subServices;
}

const transferCategories = <TransferCategory>[
  TransferCategory(
    id: 'dmt99',
    label: 'DMT 99',
    subServices: [
      TransferSubService(key: 'dmt99Dmt', label: 'DMT'),
      TransferSubService(key: 'dmt99Aeps', label: 'AEPS'),
      TransferSubService(key: 'dmt99Nepal', label: 'NEPAL'),
      TransferSubService(key: 'dmt99BillPay', label: 'BILL PAY'),
      TransferSubService(key: 'dmt99Qr', label: 'QR/UPI'),
    ],
  ),
  TransferCategory(
    id: 'dmt86',
    label: 'DMT 86',
    subServices: [
      TransferSubService(key: 'dmt86Dmt', label: 'DMT'),
      TransferSubService(key: 'dmt86Aeps', label: 'AEPS'),
      TransferSubService(key: 'dmt86Credit', label: 'CREDIT'),
      TransferSubService(key: 'dmt86BillPay', label: 'BILL PAY'),
      TransferSubService(key: 'dmt86Wallet', label: 'WALLET PPI'),
      TransferSubService(key: 'dmt86Qr', label: 'QR/UPI'),
    ],
  ),
  TransferCategory(
    id: 'ime',
    label: 'IME',
    subServices: [
      TransferSubService(key: 'imeNepal', label: 'NEPAL'),
      TransferSubService(key: 'imeAeps', label: 'AEPS'),
    ],
  ),
];

const transferServiceKeys = [
  'dmt99Dmt', 'dmt99Aeps', 'dmt99Nepal', 'dmt99BillPay', 'dmt99Qr',
  'dmt86Dmt', 'dmt86Aeps', 'dmt86Credit', 'dmt86BillPay', 'dmt86Wallet',
  'dmt86Qr', 'dmt86Nepal', 'imeAeps', 'imeNepal',
];

String getTransferLabel(String serviceKey) {
  for (final cat in transferCategories) {
    for (final sub in cat.subServices) {
      if (sub.key == serviceKey) return '${cat.label} — ${sub.label}';
    }
  }
  if (serviceKey == 'dmt86Nepal') return 'DMT 86 — NEPAL';
  return serviceKey;
}

String? getCategoryForKey(String serviceKey) {
  for (final cat in transferCategories) {
    if (cat.subServices.any((s) => s.key == serviceKey)) return cat.id;
  }
  if (serviceKey.startsWith('dmt99')) return 'dmt99';
  if (serviceKey.startsWith('dmt86')) return 'dmt86';
  if (serviceKey.startsWith('ime')) return 'ime';
  return null;
}

List<TransferSubService> getSubServicesForCategory(String categoryId) {
  return transferCategories.firstWhere((c) => c.id == categoryId).subServices;
}

Map<String, String> emptyTransferAmounts(String categoryId) {
  return {for (final s in getSubServicesForCategory(categoryId)) s.key: ''};
}
