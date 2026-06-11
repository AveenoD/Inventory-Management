const rechargeOperators = ['AIRTEL', 'JIO', 'VI', 'BSNL', 'ALL_IN_ONE'];

class RechargeAmountField {
  const RechargeAmountField({required this.key, required this.entryType, required this.label});
  final String key;
  final String entryType;
  final String label;
}

const rechargeAmountFields = <RechargeAmountField>[
  RechargeAmountField(key: 'saleProfit', entryType: 'SALE_PROFIT', label: 'Sale Profit'),
  RechargeAmountField(key: 'chillar', entryType: 'CHILLAR', label: 'Chillar'),
  RechargeAmountField(key: 'act', entryType: 'ACT', label: 'ACT'),
  RechargeAmountField(key: 'mnp', entryType: 'MNP', label: 'MNP'),
];

const rechargeEntryTypeLabels = <String, String>{
  'SALE_PROFIT': 'Sale Profit',
  'CHILLAR': 'Chillar',
  'ACT': 'ACT',
  'MNP': 'MNP',
  'MULTI': 'Multiple',
};

String getRechargeEntryTypeLabel(String entryType) =>
    rechargeEntryTypeLabels[entryType] ?? entryType;

class RechargeBreakdownPart {
  RechargeBreakdownPart({required this.entryType, required this.label, required this.amount});
  final String entryType;
  final String label;
  final String amount;
}

List<RechargeBreakdownPart> getRechargeBreakdownParts(Map<String, dynamic> row) {
  final hasColumns = rechargeAmountFields.any((f) => row[f.key] != null);
  if (hasColumns) {
    return rechargeAmountFields.expand((f) {
      final n = double.tryParse('${row[f.key] ?? 0}') ?? 0;
      if (n <= 0) return <RechargeBreakdownPart>[];
      return [RechargeBreakdownPart(entryType: f.entryType, label: f.label, amount: '$n')];
    }).toList();
  }
  if (row['entryType'] != null) {
    final n = double.tryParse('${row['amount'] ?? 0}') ?? 0;
    return [
      RechargeBreakdownPart(
        entryType: '${row['entryType']}',
        label: getRechargeEntryTypeLabel('${row['entryType']}'),
        amount: '$n',
      ),
    ];
  }
  return [];
}

String formatRechargeTypeLabel(Map<String, dynamic> row) {
  final parts = getRechargeBreakdownParts(row);
  return parts.map((p) => p.label).join(' + ').isEmpty ? '—' : parts.map((p) => p.label).join(' + ');
}
