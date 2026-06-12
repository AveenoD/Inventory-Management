import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_service.dart';
import '../auth/auth_provider.dart';

/// Registers device for push when authenticated.
/// Full FCM requires `google-services.json` (Android) / APNs (iOS) in platform folders.
class PushService {
  PushService(this._api);

  final ApiService _api;
  bool _registered = false;

  Future<void> setupIfAuthenticated(bool isAuthenticated) async {
    if (!isAuthenticated || _registered || kIsWeb) return;
    try {
      // FCM token retrieval requires firebase_messaging + platform config.
      // Register a stable device id placeholder until Firebase is configured.
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _api.registerPushDevice({
        'platform': platform,
        'token': 'flutter-pending-fcm-setup',
      });
      _registered = true;
    } catch (_) {
      // Push is optional — inbox still works via API polling.
    }
  }
}

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(ref.watch(apiServiceProvider));
});

final pushSetupProvider = Provider<void>((ref) {
  void setup(AuthState auth) {
    if (!auth.isLoading && auth.isAuthenticated) {
      ref.read(pushServiceProvider).setupIfAuthenticated(true);
    }
  }

  setup(ref.read(authProvider));
  ref.listen<AuthState>(authProvider, (_, next) => setup(next));
});
