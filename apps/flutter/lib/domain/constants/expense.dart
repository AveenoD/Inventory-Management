class ExpenseCategory {
  const ExpenseCategory({required this.key, required this.label, required this.group});
  final String key;
  final String label;
  final String group;
}

const expenseCategories = <ExpenseCategory>[
  ExpenseCategory(key: 'SALARY', label: 'Salary', group: 'SHOP_EXPENSE'),
  ExpenseCategory(key: 'TEA', label: 'Tea & Refreshments', group: 'SHOP_EXPENSE'),
  ExpenseCategory(key: 'SHOP', label: 'Shop Expense', group: 'SHOP_EXPENSE'),
  ExpenseCategory(key: 'ACCESSORIES_DAMAGE', label: 'Accessories Damage', group: 'DAMAGE'),
  ExpenseCategory(key: 'REPAIRING_DAMAGE', label: 'Repairing Damage', group: 'DAMAGE'),
];

String getExpenseCategoryLabel(String key) {
  return expenseCategories.firstWhere((c) => c.key == key, orElse: () => ExpenseCategory(key: key, label: key, group: 'SHOP_EXPENSE')).label;
}

class ExpenseLineItem {
  ExpenseLineItem({
    required this.id,
    required this.date,
    required this.categoryKey,
    required this.lineCategory,
    required this.type,
    required this.description,
    required this.amount,
    required this.paymentMethod,
    this.withdrawalId,
  });

  final String id;
  final String date;
  final String categoryKey;
  final String lineCategory;
  final String type;
  final String description;
  final double amount;
  final String paymentMethod;
  final String? withdrawalId;
}

double _num(dynamic v) => (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

List<ExpenseLineItem> buildExpenseLineItems(
  List<Map<String, dynamic>> shopDays,
  List<Map<String, dynamic>> damageDays,
  List<Map<String, dynamic>> withdrawals,
) {
  final rows = <ExpenseLineItem>[];

  for (final d in shopDays) {
    final date = '${d['date'] ?? ''}';
    const pairs = [
      ('SALARY', 'salaryAmount', 'salaryDescription'),
      ('TEA', 'teaAmount', 'teaDescription'),
      ('SHOP', 'shopExpAmount', 'shopExpDescription'),
    ];
    for (final (key, amtKey, descKey) in pairs) {
      final amount = _num(d[amtKey]);
      final desc = '${d[descKey] ?? ''}'.trim();
      if (amount > 0 || desc.isNotEmpty) {
        rows.add(ExpenseLineItem(
          id: 'exp-$date-$key',
          date: date,
          categoryKey: key,
          lineCategory: 'SHOP_EXPENSE',
          type: getExpenseCategoryLabel(key),
          description: desc.isNotEmpty ? desc : getExpenseCategoryLabel(key),
          amount: amount,
          paymentMethod: 'Cash',
        ));
      }
    }
  }

  for (final d in damageDays) {
    final date = '${d['date'] ?? ''}';
    const pairs = [
      ('ACCESSORIES_DAMAGE', 'accessoriesAmount', 'accessoriesDescription'),
      ('REPAIRING_DAMAGE', 'repairingAmount', 'repairingDescription'),
    ];
    for (final (key, amtKey, descKey) in pairs) {
      final amount = _num(d[amtKey]);
      final desc = '${d[descKey] ?? ''}'.trim();
      if (amount > 0 || desc.isNotEmpty) {
        rows.add(ExpenseLineItem(
          id: 'exp-$date-$key',
          date: date,
          categoryKey: key,
          lineCategory: 'DAMAGE',
          type: getExpenseCategoryLabel(key),
          description: desc.isNotEmpty ? desc : getExpenseCategoryLabel(key),
          amount: amount,
          paymentMethod: '—',
        ));
      }
    }
  }

  for (final w in withdrawals) {
    final amount = _num(w['total']);
    if (amount <= 0) continue;
    final id = '${w['id'] ?? ''}';
    final date = '${w['date'] ?? ''}';
    rows.add(ExpenseLineItem(
      id: id.isNotEmpty ? 'wd-$id' : 'wd-$date-$amount',
      date: date,
      categoryKey: 'WITHDRAWAL',
      lineCategory: 'WITHDRAWAL',
      type: 'Withdraw',
      description: '${w['description'] ?? ''}'.trim().isNotEmpty
          ? '${w['description']}'.trim()
          : 'Withdrawal from profit',
      amount: amount,
      paymentMethod: _num(w['bank']) > 0 ? 'Bank' : 'Cash',
      withdrawalId: id.isNotEmpty ? id : null,
    ));
  }

  rows.sort((a, b) => b.date.compareTo(a.date) != 0
      ? b.date.compareTo(a.date)
      : a.type.compareTo(b.type));
  return rows;
}
