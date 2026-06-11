import 'package:flutter/material.dart';

/// Design tokens mirrored from apps/mobile/theme/tokens.ts
abstract final class AppColors {
  static const pageBg = Color(0xFFF1F5F9);
  static const card = Color(0xFFFFFFFF);
  static const border = Color(0xFFE2E8F0);
  static const text = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const accent = Color(0xFF2563EB);
  static const accentDark = Color(0xFF1D4ED8);
  static const accentLight = Color(0xFFEFF6FF);
  static const green = Color(0xFF16A34A);
  static const red = Color(0xFFDC2626);
  static const amber = Color(0xFFD97706);
  static const amberBg = Color(0xFFFFFBEB);
  static const purple = Color(0xFF7C3AED);
  static const shadow = Color(0x140F172A);

  static const modalOverlay = Color(0x730F172A); // rgba(15,23,42,0.45)

  static const gradientBlue = [Color(0xFFEFF6FF), Color(0xFFFFFFFF)];
  static const gradientGreen = [Color(0xFFF0FDF4), Color(0xFFFFFFFF)];
  static const gradientAmber = [Color(0xFFFFFBEB), Color(0xFFFFFFFF)];
  static const gradientPurple = [Color(0xFFFAF5FF), Color(0xFFFFFFFF)];
  static const gradientTeal = [Color(0xFFF0FDFA), Color(0xFFFFFFFF)];
  static const gradientOrange = [Color(0xFFFFF7ED), Color(0xFFFFFFFF)];

  static const iconBgBlue = Color(0xFFEFF6FF);
  static const iconBgGreen = Color(0xFFF0FDF4);
  static const iconBgAmber = Color(0xFFFFFBEB);
  static const iconBgPurple = Color(0xFFFAF5FF);
  static const iconBgTeal = Color(0xFFF0FDFA);
  static const iconBgOrange = Color(0xFFFFF7ED);
}

abstract final class AppRadii {
  static const input = 10.0;
  static const card = 14.0;
  static const pill = 999.0;
}

abstract final class AppSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
}
