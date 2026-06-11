import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Bordered dropdown — mirrors apps/mobile/components/ui/filter-picker.tsx
class FilterPicker<T> extends StatelessWidget {
  const FilterPicker({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
    this.labelBuilder,
  });

  final T value;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String Function(T value)? labelBuilder;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadii.input),
        color: AppColors.card,
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          isExpanded: true,
          value: value,
          items: [
            for (final item in items)
              DropdownMenuItem(
                value: item,
                child: Text(
                  labelBuilder?.call(item) ?? '$item',
                  style: const TextStyle(fontSize: 16, color: AppColors.text),
                ),
              ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}
