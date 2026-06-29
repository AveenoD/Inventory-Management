import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _tokenKey = 'sk_mobile_token';
const _pinKey = 'sk_mobile_pin';
const _emailKey = 'sk_mobile_email';
const _passwordKey = 'sk_mobile_password';

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

  Future<void> setPinAndCredentials(String pin, String email, String password) async {
    await _storage.write(key: _pinKey, value: pin);
    await _storage.write(key: _emailKey, value: email);
    await _storage.write(key: _passwordKey, value: password);
  }

  Future<String?> getPin() => _storage.read(key: _pinKey);
  Future<String?> getEmail() => _storage.read(key: _emailKey);
  Future<String?> getPassword() => _storage.read(key: _passwordKey);

  /// Clears only the API token (used when session expires, preserving the PIN lock)
  Future<void> clearToken() async {
    _cached = null;
    await _storage.delete(key: _tokenKey);
  }

  /// Completely wipes everything (used on manual logout or "Forgot PIN")
  Future<void> clearAll() async {
    _cached = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _pinKey);
    await _storage.delete(key: _emailKey);
    await _storage.delete(key: _passwordKey);
  }
}
