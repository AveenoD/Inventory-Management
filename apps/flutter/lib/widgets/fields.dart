import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_icons.dart';

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key, this.optional = false});

  final String text;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.lg, bottom: AppSpacing.sm),
      child: Row(
        children: [
          Text(
            text.toUpperCase(),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.muted,
              letterSpacing: 0.4,
            ),
          ),
          if (optional)
            const Padding(
              padding: EdgeInsets.only(left: 6),
              child: Text('(optional)', style: TextStyle(fontSize: 12, color: AppColors.muted)),
            ),
        ],
      ),
    );
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.hint,
    this.keyboardType,
    this.obscureText = false,
    this.onChanged,
    this.suffix,
    this.maxLines = 1,
  });

  final TextEditingController? controller;
  final String? hint;
  final TextInputType? keyboardType;
  final bool obscureText;
  final ValueChanged<String>? onChanged;
  final Widget? suffix;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      onChanged: onChanged,
      maxLines: maxLines,
      style: const TextStyle(color: AppColors.text, fontSize: 16),
      decoration: InputDecoration(hintText: hint, suffixIcon: suffix),
    );
  }
}

class DateField extends StatelessWidget {
  const DateField({super.key, required this.value, required this.onChanged, this.label});

  final String value;
  final ValueChanged<String> onChanged;
  final String? label;

  Future<void> _pick(BuildContext context) async {
    final initial = DateTime.tryParse(value) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      onChanged('${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) FieldLabel(label!),
        Material(
          color: AppColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.input),
            side: const BorderSide(color: AppColors.border),
          ),
          child: InkWell(
            onTap: () => _pick(context),
            borderRadius: BorderRadius.circular(AppRadii.input),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
              child: Row(
                children: [
                  const Icon(AppIcons.calendar, size: 16, color: AppColors.muted),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    value.isEmpty ? 'Select date' : value,
                    style: const TextStyle(fontSize: 16, height: 20 / 16, color: AppColors.text),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Search input — mirrors apps/mobile/components/ui/form-fields.tsx SearchField + searchRow.
abstract final class SearchFieldMetrics {
  static const fontSize = 15.0;
  static const verticalPadding = 10.0;
  static const minHeight = 40.0;
}

class SearchField extends StatefulWidget {
  const SearchField({
    super.key,
    required this.value,
    required this.onChanged,
    this.placeholder,
    this.showIcon = true,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final String? placeholder;
  /// When true, renders the tab-page search row (icon + field). When false, standalone bordered field (parties).
  final bool showIcon;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  late final TextEditingController _controller;

  static const _textStyle = TextStyle(
    fontSize: SearchFieldMetrics.fontSize,
    height: 20 / SearchFieldMetrics.fontSize,
    color: AppColors.text,
  );

  static const _hintStyle = TextStyle(
    fontSize: SearchFieldMetrics.fontSize,
    height: 20 / SearchFieldMetrics.fontSize,
    color: AppColors.muted,
  );

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(SearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != oldWidget.value && widget.value != _controller.text) {
      _controller.text = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  InputDecoration _decoration({required EdgeInsets contentPadding}) {
    return InputDecoration(
      hintText: widget.placeholder,
      hintStyle: _hintStyle,
      border: InputBorder.none,
      enabledBorder: InputBorder.none,
      focusedBorder: InputBorder.none,
      filled: false,
      contentPadding: contentPadding,
      isDense: true,
      isCollapsed: true,
    );
  }

  Widget _input({required EdgeInsets contentPadding}) {
    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      style: _textStyle,
      decoration: _decoration(contentPadding: contentPadding),
      autocorrect: false,
      textCapitalization: TextCapitalization.none,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.showIcon) {
      return Container(
        width: double.infinity,
        constraints: const BoxConstraints(minHeight: SearchFieldMetrics.minHeight),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.input),
          border: Border.all(color: AppColors.border),
        ),
        alignment: Alignment.center,
        child: _input(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: SearchFieldMetrics.verticalPadding,
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: SearchFieldMetrics.minHeight),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.only(left: AppSpacing.md),
      child: Row(
        children: [
          const Icon(AppIcons.search, size: 16, color: AppColors.muted),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _input(
              contentPadding: const EdgeInsets.only(
                right: AppSpacing.md,
                top: SearchFieldMetrics.verticalPadding,
                bottom: SearchFieldMetrics.verticalPadding,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({
    super.key,
    required this.title,
    required this.message,
    required this.onConfirm,
    this.confirmLabel = 'Delete',
    this.danger = true,
  });

  final String title;
  final String message;
  final VoidCallback onConfirm;
  final String confirmLabel;
  final bool danger;

  static Future<void> show(
    BuildContext context, {
    required String title,
    required String message,
    required VoidCallback onConfirm,
    String confirmLabel = 'Delete',
  }) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => ConfirmDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        onConfirm: () {
          Navigator.pop(ctx);
          onConfirm();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        TextButton(
          onPressed: onConfirm,
          child: Text(confirmLabel, style: TextStyle(color: danger ? AppColors.red : AppColors.accent)),
        ),
      ],
    );
  }
}
