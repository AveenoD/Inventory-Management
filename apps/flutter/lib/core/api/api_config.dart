import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Same production URL as web (`apps/web/src/lib/api.ts`) and Expo mobile.
const productionApiUrl = 'https://sk-mobile-api.onrender.com';

/// Local API — same as web/mobile dev default.
const localApiUrl = 'http://localhost:4000';

/// Android emulator maps host machine localhost to 10.0.2.2.
const androidEmulatorApiUrl = 'http://10.0.2.2:4000';

String resolveApiBaseUrl() {
  final fromEnv = dotenv.env['API_URL']?.replaceAll(RegExp(r'/$'), '');
  if (fromEnv != null && fromEnv.isNotEmpty) return fromEnv;

  if (kDebugMode) {
    if (Platform.isAndroid) return androidEmulatorApiUrl;
    return localApiUrl;
  }

  return productionApiUrl;
}
