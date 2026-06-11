import 'package:flutter/material.dart';
import '../../core/theme/app_icons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/screen_shell.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _loading = true;
  bool _markingAll = false;
  int _unread = 0;
  String? _error;
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadNotifications());
  }

  Future<void> _loadNotifications() async {
    final auth = ref.read(authProvider);
    if (!auth.isAuthenticated) {
      setState(() {
        _loading = false;
        _error = 'Please login to view notifications.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final res = await api.getNotifications(page: 1, limit: 50);
      if (!mounted) return;
      setState(() {
        _items = (res['data'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        final metaUnread = (res['meta'] is Map) ? (res['meta']['unreadCount'] as int?) : null;
        _unread = metaUnread ?? (res['unreadCount'] as int? ?? 0);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiError ? e.message : 'Could not load notifications.';
        _loading = false;
      });
    }
  }

  Future<void> _markRead(String id) async {
    try {
      final api = ref.read(apiServiceProvider);
      await api.markNotificationRead(id);
      await _loadNotifications();
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      final api = ref.read(apiServiceProvider);
      await api.markAllNotificationsRead();
      await _loadNotifications();
    } catch (_) {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  String _formatWhen(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    final mins = DateTime.now().difference(d).inMinutes;
    if (mins < 1) return 'Just now';
    if (mins < 60) return '${mins}m ago';
    final hrs = mins ~/ 60;
    if (hrs < 24) return '${hrs}h ago';
    return '${d.day}/${d.month}/${d.year}';
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'LOW_STOCK':
        return 'Stock';
      case 'REPAIR_PICKUP':
        return 'Pickup';
      case 'REPAIR_RECEIVED':
        return 'Repair';
      default:
        return 'Alert';
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScreenShell(
      title: 'Notifications',
      subtitle: _unread > 0 ? '$_unread unread' : 'In-app inbox',
      showBack: true,
      refreshing: _loading && _items.isNotEmpty,
      onRefresh: _loadNotifications,
      headerAction: _unread > 0
          ? IconButton(
              onPressed: _markingAll ? null : _markAllRead,
              icon: Icon(
                AppIcons.checkCheck,
                color: _markingAll ? AppColors.muted : AppColors.accent,
              ),
            )
          : null,
      child: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Text(_error!, style: const TextStyle(color: AppColors.red));
    }
    if (_items.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: const Center(
          child: Text(
            'No notifications yet.\nStock and repair alerts will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
        ),
      );
    }

    return Column(
      children: [
        for (final n in _items)
          _NotificationTile(
            item: n,
            formatWhen: _formatWhen,
            typeLabel: _typeLabel,
            onTapUnread: _markRead,
          ),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.item,
    required this.formatWhen,
    required this.typeLabel,
    required this.onTapUnread,
  });

  final Map<String, dynamic> item;
  final String Function(String) formatWhen;
  final String Function(String) typeLabel;
  final Future<void> Function(String) onTapUnread;

  @override
  Widget build(BuildContext context) {
    final id = item['id']?.toString() ?? '';
    final unread = item['readAt'] == null;
    final createdAt = item['createdAt']?.toString() ?? '';
    final type = item['type']?.toString() ?? 'ALERT';
    return InkWell(
      onTap: () {
        if (unread && id.isNotEmpty) onTapUnread(id);
      },
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        decoration: BoxDecoration(
          color: unread ? const Color(0xFFF8FAFC) : AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: unread ? AppColors.accent : AppColors.border),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  typeLabel(type).toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: AppColors.accent,
                  ),
                ),
                const Spacer(),
                Text(
                  formatWhen(createdAt),
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              item['title']?.toString() ?? 'Notification',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.text),
            ),
            const SizedBox(height: 2),
            Text(
              item['body']?.toString() ?? '',
              style: const TextStyle(fontSize: 14, color: AppColors.muted, height: 1.35),
            ),
          ],
        ),
      ),
    );
  }
}
