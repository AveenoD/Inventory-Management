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

int? _asInt(dynamic value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '');
}

String? _asString(dynamic value) {
  if (value == null) return null;
  final s = value.toString();
  return s.isEmpty ? null : s;
}

String? _pickMonthId(List<Map<String, dynamic>> list, int year, int month) {
  if (list.isEmpty) return null;
  for (final x in list) {
    if (_asInt(x['year']) == year && _asInt(x['month']) == month) {
      return _asString(x['id']);
    }
  }
  final sorted = [...list]
    ..sort((a, b) {
      final ay = _asInt(a['year']) ?? 0;
      final by = _asInt(b['year']) ?? 0;
      if (ay != by) return by.compareTo(ay);
      return (_asInt(b['month']) ?? 0).compareTo(_asInt(a['month']) ?? 0);
    });
  return _asString(sorted.first['id']);
}

final monthProvider = FutureProvider<MonthState>((ref) async {
  final auth = ref.watch(authProvider);
  final now = DateTime.now();

  // Wait for auth — same as Expo: enabled only when !authLoading.
  if (auth.isLoading) {
    return MonthState(
      monthId: null,
      year: now.year,
      month: now.month,
      isLoading: true,
    );
  }
  if (!auth.isAuthenticated) {
    return MonthState(monthId: null, year: now.year, month: now.month, isLoading: false);
  }

  final api = ref.watch(apiServiceProvider);
  final res = await api.getMonths(page: 1, limit: 24);
  var list = (res['data'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();

  // Mirror API month-resolver: ensure current month exists (dashboard /today does this too).
  if (list.isEmpty) {
    final created = await api.createMonth({
      'year': now.year,
      'month': now.month,
      'openingBalance': 0,
    });
    list = [created];
  }

  return MonthState(
    monthId: _pickMonthId(list, now.year, now.month),
    year: now.year,
    month: now.month,
    isLoading: false,
  );
});
