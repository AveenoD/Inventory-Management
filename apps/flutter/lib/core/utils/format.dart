import 'package:intl/intl.dart';
import 'dart:convert';
import 'dart:typed_data';

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

String formatInvoiceDate(String date) {
  try {
    return DateFormat('d MMM yyyy', 'en_IN').format(DateTime.parse(date));
  } catch (_) {
    return date;
  }
}

const _ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const _tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

String _twoDigits(int n) {
  if (n < 20) return _ones[n];
  final t = n ~/ 10;
  final o = n % 10;
  return '${_tens[t]}${o > 0 ? ' ${_ones[o]}' : ''}'.trim();
}

String _threeDigits(int n) {
  if (n == 0) return '';
  final h = n ~/ 100;
  final rest = n % 100;
  return '${h > 0 ? '${_ones[h]} Hundred' : ''}${rest > 0 ? '${h > 0 ? ' ' : ''}${_twoDigits(rest)}' : ''}'
      .trim();
}

String _integerToWords(int n) {
  if (n == 0) return 'Zero';
  final parts = <String>[];
  var remaining = n;
  final crore = remaining ~/ 10000000;
  remaining %= 10000000;
  final lakh = remaining ~/ 100000;
  remaining %= 100000;
  final thousand = remaining ~/ 1000;
  remaining %= 1000;
  if (crore > 0) parts.add('${_twoDigits(crore)} Crore');
  if (lakh > 0) parts.add('${_twoDigits(lakh)} Lakh');
  if (thousand > 0) parts.add('${_twoDigits(thousand)} Thousand');
  if (remaining > 0) parts.add(_threeDigits(remaining));
  return parts.join(' ');
}

String amountInWords(num? value) {
  final n = parseMoney('$value');
  final rupees = n.floor();
  final paise = ((n - rupees) * 100).round();
  var words = _integerToWords(rupees);
  words += rupees == 1 ? ' Rupee' : ' Rupees';
  if (paise > 0) {
    words += ' and ${_integerToWords(paise)} ${paise == 1 ? 'Paisa' : 'Paise'}';
  }
  return '$words Only';
}

Uint8List? decodeDataUrlImage(String? dataUrl) {
  if (dataUrl == null || dataUrl.isEmpty) return null;
  final comma = dataUrl.indexOf(',');
  if (comma == -1) return null;
  try {
    return Uint8List.fromList(base64Decode(dataUrl.substring(comma + 1)));
  } catch (_) {
    return null;
  }
}
