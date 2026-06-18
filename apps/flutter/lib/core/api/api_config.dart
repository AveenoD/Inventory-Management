/// API base URL for Flutter app.
///
/// Override at build time:
/// `flutter build apk --release --dart-define=API_URL=http://192.168.1.42:4000`
const kApiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://sk-mobile-api.onrender.com',
);

String get apiBaseUrl => kApiBaseUrl.replaceAll(RegExp(r'/$'), '');
