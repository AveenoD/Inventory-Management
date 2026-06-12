import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/month/month_provider.dart';
import '../core/theme/app_colors.dart';
import 'page_loader.dart';

class MonthGate extends ConsumerWidget {
  const MonthGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final month = ref.watch(monthProvider);

    return month.when(
      loading: () => const PageLoader(message: 'Preparing business month…'),
      error: (e, _) => Center(
        child: Container(
          margin: const EdgeInsets.all(AppSpacing.lg),
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            border: Border.all(color: const Color(0xFFFECACA)),
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Could not load business month', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: AppSpacing.sm),
              Text('$e', style: const TextStyle(fontSize: 14, color: AppColors.muted)),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: () => ref.invalidate(monthProvider),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: Colors.white),
                child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
      data: (state) {
        if (state.isLoading) {
          return const PageLoader(message: 'Preparing business month…');
        }
        if (state.monthId == null) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('No business month selected', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: AppSpacing.sm),
                  const Text('Create or select a business month to continue.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
                  const SizedBox(height: AppSpacing.lg),
                  ElevatedButton(
                    onPressed: () => context.push('/months'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: Colors.white),
                    child: const Text('Go to Business Months'),
                  ),
                ],
              ),
            ),
          );
        }
        return child;
      },
    );
  }
}
