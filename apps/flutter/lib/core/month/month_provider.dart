import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_provider.dart';

class MonthState {
  const MonthState({
    required this.monthId,
    required this.year,
    required this.month,
    required this.isLoading,
    this.error,
  });

  final String? monthId;
  final int year;
  final int month;
  final bool isLoading;
  final Object? error;
}

String? _pickMonthId(List<Map<String, dynamic>> list, int year, int month) {
  if (list.isEmpty) return null;
  for (final x in list) {
    if (x['year'] == year && x['month'] == month) return x['id'] as String?;
  }
  final sorted = [...list]
    ..sort((a, b) {
      final ay = (a['year'] as int?) ?? 0;
      final by = (b['year'] as int?) ?? 0;
      if (ay != by) return by.compareTo(ay);
      return ((b['month'] as int?) ?? 0).compareTo((a['month'] as int?) ?? 0);
    });
  return sorted.first['id'] as String?;
}

final monthProvider = FutureProvider<MonthState>((ref) async {
  final auth = ref.watch(authProvider);
  if (auth.isLoading) {
    return MonthState(
      monthId: null,
      year: DateTime.now().year,
      month: DateTime.now().month,
      isLoading: true,
    );
  }
  if (!auth.isAuthenticated) {
    final now = DateTime.now();
    return MonthState(monthId: null, year: now.year, month: now.month, isLoading: false);
  }

  final api = ref.watch(apiServiceProvider);
  final now = DateTime.now();
  try {
    final res = await api.getMonths(page: 1, limit: 24);
    final list = (res['data'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    return MonthState(
      monthId: _pickMonthId(list, now.year, now.month),
      year: now.year,
      month: now.month,
      isLoading: false,
    );
  } catch (e) {
    return MonthState(
      monthId: null,
      year: now.year,
      month: now.month,
      isLoading: false,
      error: e,
    );
  }
});
