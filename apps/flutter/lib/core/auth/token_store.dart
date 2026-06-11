import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _tokenKey = 'sk_mobile_token';

class TokenStore {
  TokenStore() : _storage = const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  String? _cached;

  String? get token => _cached;

  Future<void> load() async {
    _cached = await _storage.read(key: _tokenKey);
  }

  Future<void> setToken(String token) async {
    _cached = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<void> clear() async {
    _cached = null;
    await _storage.delete(key: _tokenKey);
  }
}
