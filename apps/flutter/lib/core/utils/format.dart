import 'package:intl/intl.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
final _monthFmt = DateFormat('MMMM yyyy', 'en_IN');
final _dateFmt = DateFormat('yyyy-MM-dd');
final _displayDate = DateFormat('d MMM yyyy', 'en_IN');
final _timeFmt = DateFormat('h:mm a', 'en_IN');

String formatMoney(num? value) => _inr.format(value ?? 0);

double parseMoney(String? value) {
  if (value == null || value.trim().isEmpty) return 0;
  return double.tryParse(value.replaceAll(',', '').trim()) ?? 0;
}

double sumMoney(Iterable<dynamic> values) =>
    values.fold<double>(0, (sum, v) => sum + parseMoney('$v'));

String todayIso() => _dateFmt.format(DateTime.now());

String formatDateLabel(String date) {
  try {
    return DateFormat('EEEE, d MMM, yyyy', 'en_IN').format(DateTime.parse(date));
  } catch (_) {
    return date;
  }
}

String formatDisplayDate(String iso) {
  try {
    return _displayDate.format(DateTime.parse(iso));
  } catch (_) {
    return iso;
  }
}

String formatTime(DateTime dt) => _timeFmt.format(dt);

String monthLabel(int year, int month) {
  return _monthFmt.format(DateTime(year, month));
}

String monthShortLabel(int year, int month) {
  return DateFormat('MMM yyyy', 'en_IN').format(DateTime(year, month));
}
