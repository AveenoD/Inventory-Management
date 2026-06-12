import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import 'buttons.dart';

class FormModal extends StatelessWidget {
  const FormModal({
    super.key,
    required this.visible,
    required this.title,
    this.subtitle,
    required this.onClose,
    required this.child,
    this.scroll = true,
  });

  final bool visible;
  final String title;
  final String? subtitle;
  final VoidCallback onClose;
  final Widget child;
  final bool scroll;

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: AppColors.modalOverlay,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: GestureDetector(
            onTap: () {},
            child: DraggableScrollableSheet(
              initialChildSize: 0.7,
              minChildSize: 0.4,
              maxChildSize: 0.9,
              builder: (context, scrollController) => Container(
                decoration: const BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                          if (subtitle != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(subtitle!, style: const TextStyle(color: AppColors.muted, fontSize: 14)),
                            ),
                          const Divider(height: 24),
                        ],
                      ),
                    ),
                    Expanded(
                      child: scroll
                          ? SingleChildScrollView(
                              controller: scrollController,
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                              child: child,
                            )
                          : Padding(padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg), child: child),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ModalActions extends StatelessWidget {
  const ModalActions({
    super.key,
    required this.onCancel,
    required this.onConfirm,
    this.confirmLabel = 'Save',
    this.cancelLabel = 'Cancel',
    this.loading = false,
    this.disabled = false,
  });

  final VoidCallback onCancel;
  final VoidCallback onConfirm;
  final String confirmLabel;
  final String cancelLabel;
  final bool loading;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.lg),
      child: Row(
        children: [
          Expanded(child: SecondaryButton(label: cancelLabel, onPressed: onCancel)),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: PrimaryButton(
              label: confirmLabel,
              onPressed: onConfirm,
              loading: loading,
              disabled: disabled,
            ),
          ),
        ],
      ),
    );
  }
}
