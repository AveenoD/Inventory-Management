import 'package:flutter/material.dart';
import '../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_provider.dart';
import '../core/theme/app_colors.dart';
import '../features/auth/login_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/expenses/expenses_screen.dart';
import '../features/inventory/inventory_list_screen.dart';
import '../features/inventory/new_product_screen.dart';
import '../features/inventory/stock_in_screen.dart';
import '../features/months/months_screen.dart';
import '../features/not_found/not_found_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/parties/parties_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/purchases/new_purchase_screen.dart';
import '../features/purchases/purchases_list_screen.dart';
import '../features/recharge/recharge_screen.dart';
import '../features/repair/repair_screen.dart';
import '../features/reports/reports_screen.dart';
import '../features/sales/new_sale_screen.dart';
import '../features/sales/sales_list_screen.dart';
import '../features/invoice/sale_invoice_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/transfer/transfer_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Re-runs [GoRouter] redirect on auth changes without recreating the router instance.
/// Recreating GoRouter breaks [StatefulShellRoute.indexedStack] and causes a blank shell body.
class _AuthRouterRefresh extends ChangeNotifier {
  _AuthRouterRefresh(Ref ref) {
    ref.listen<AuthState>(authProvider, (_, __) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      if (auth.isLoading) return null;
      final loggingIn = state.matchedLocation == '/login';
      if (!auth.isAuthenticated && !loggingIn) return '/login';
      if (auth.isAuthenticated && loggingIn) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            _TabShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/sales', builder: (_, __) => const SalesListScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/repair',
              builder: (_, state) => RepairScreen(
                openIntake: state.uri.queryParameters['intake'] == '1',
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/recharge', builder: (_, __) => const RechargeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/transfer', builder: (_, __) => const TransferScreen()),
          ]),
        ],
      ),
      GoRoute(path: '/sales/new', builder: (_, __) => const NewSaleScreen()),
      GoRoute(
        path: '/sales/:id/invoice',
        builder: (_, state) => SaleInvoiceScreen(saleId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/months', builder: (_, __) => const MonthsScreen()),
      GoRoute(path: '/inventory', builder: (_, __) => const InventoryListScreen()),
      GoRoute(path: '/inventory/new', builder: (_, __) => const NewProductScreen()),
      GoRoute(
        path: '/inventory/:id/stock',
        builder: (_, state) => StockInScreen(productId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/expenses', builder: (_, __) => const ExpensesScreen()),
      GoRoute(path: '/parties', builder: (_, __) => const PartiesScreen()),
      GoRoute(path: '/purchases', builder: (_, __) => const PurchasesListScreen()),
      GoRoute(path: '/purchases/new', builder: (_, __) => const NewPurchaseScreen()),
      GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    ],
    errorBuilder: (_, __) => const NotFoundScreen(),
  );

  ref.onDispose(router.dispose);
  return router;
});

class _TabShell extends StatelessWidget {
  const _TabShell({required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.pageBg,
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.card,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: SafeArea(
          child: SizedBox(
            height: 72,
            child: Row(
              children: [
                _tab(0, AppIcons.creditCard, 'Sales'),
                _tab(1, AppIcons.wrench, 'Repairs'),
                _centerTab(context),
                _tab(3, AppIcons.zap, 'Recharge'),
                _tab(4, AppIcons.arrowLeftRight, 'Transfer'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _tab(int index, IconData icon, String label) {
    final selected = navigationShell.currentIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => navigationShell.goBranch(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: selected ? 24 : 22, color: selected ? AppColors.accent : AppColors.muted),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.accent : AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _centerTab(BuildContext context) {
    final selected = navigationShell.currentIndex == 2;
    return Expanded(
      child: InkWell(
        onTap: () => navigationShell.goBranch(2),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Transform.translate(
              offset: const Offset(0, -18),
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: selected ? AppColors.accentDark : AppColors.accent,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(AppIcons.layoutDashboard, color: Colors.white, size: 24),
              ),
            ),
            Text(
              'Dashboard',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.accent : AppColors.muted,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
