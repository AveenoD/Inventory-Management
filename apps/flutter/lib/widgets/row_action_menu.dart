import 'package:flutter/material.dart';
import '../core/theme/app_icons.dart';

import '../core/theme/app_colors.dart';

class RowActionMenuItem {
  const RowActionMenuItem({
    required this.key,
    required this.label,
    required this.onPress,
    this.danger = false,
  });

  final String key;
  final String label;
  final VoidCallback onPress;
  final bool danger;
}

class RowActionMenu extends StatelessWidget {
  const RowActionMenu({super.key, required this.items, this.disabled = false});

  final List<RowActionMenuItem> items;
  final bool disabled;

  void _show(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final item in items)
                ListTile(
                  title: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: item.danger ? AppColors.red : AppColors.text,
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    item.onPress();
                  },
                ),
              Container(
                color: AppColors.pageBg,
                child: ListTile(
                  title: const Text(
                    'Cancel',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600),
                  ),
                  onTap: () => Navigator.pop(ctx),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: InkWell(
        onTap: disabled ? null : () => _show(context),
        borderRadius: BorderRadius.circular(AppRadii.input),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.input),
            color: AppColors.card,
          ),
          child: const Icon(AppIcons.moreVertical, size: 16, color: AppColors.muted),
        ),
      ),
    );
  }
}
