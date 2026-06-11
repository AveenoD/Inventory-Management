import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

enum BadgeTone { defaultTone, ok, warning, danger, upi, card }

/// Status badge — mirrors apps/mobile/components/ui/badge.tsx
class AppBadge extends StatelessWidget {
  const AppBadge({super.key, required this.label, this.tone = BadgeTone.defaultTone});

  final String label;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, border, text) = _colors();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: text),
      ),
    );
  }

  (Color, Color, Color) _colors() {
    switch (tone) {
      case BadgeTone.ok:
        return (const Color(0xFFF0FDF4), const Color(0xFFBBF7D0), AppColors.green);
      case BadgeTone.warning:
        return (AppColors.amberBg, const Color(0xFFFDE68A), AppColors.amber);
      case BadgeTone.danger:
        return (const Color(0xFFFEF2F2), const Color(0xFFFECACA), AppColors.red);
      case BadgeTone.upi:
        return (const Color(0xFFEFF6FF), const Color(0xFFBFDBFE), AppColors.accent);
      case BadgeTone.card:
        return (const Color(0xFFFAF5FF), const Color(0xFFE9D5FF), AppColors.purple);
      case BadgeTone.defaultTone:
        return (AppColors.pageBg, AppColors.border, AppColors.muted);
    }
  }
}

BadgeTone repairStatusTone(String status) {
  if (status == 'REPAIRED_PENDING_PICKUP') return BadgeTone.warning;
  if (status == 'DELIVERED') return BadgeTone.ok;
  return BadgeTone.defaultTone;
}

BadgeTone paymentBadgeTone(String method) {
  switch (method) {
    case 'CASH':
      return BadgeTone.ok;
    case 'UPI':
      return BadgeTone.upi;
    case 'CARD':
      return BadgeTone.card;
    default:
      return BadgeTone.defaultTone;
  }
}

String paymentLabel(String method) {
  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'UPI':
      return 'UPI';
    case 'CARD':
      return 'Card';
    default:
      return method;
  }
}
