import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_service.dart';
import 'token_store.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiServiceProvider = Provider<ApiService>((ref) {
  final store = ref.watch(tokenStoreProvider);
  return ApiService(store);
});

class AuthState {
  const AuthState({required this.isLoading, required this.isAuthenticated, required this.hasPin});

  final bool isLoading;
  final bool isAuthenticated;
  final bool hasPin;

  AuthState copyWith({bool? isLoading, bool? isAuthenticated, bool? hasPin}) => AuthState(
        isLoading: isLoading ?? this.isLoading,
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        hasPin: hasPin ?? this.hasPin,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._store, this._api)
      : super(const AuthState(isLoading: true, isAuthenticated: false, hasPin: false)) {
    _api.setUnauthorizedHandler(() {
      logout();
    });
    _init();
  }

  final TokenStore _store;
  final ApiService _api;

  Future<void> _init() async {
    await _store.load();
    final hasPin = (await _store.getPin()) != null;
    state = AuthState(isLoading: false, isAuthenticated: _store.token != null, hasPin: hasPin);
  }

  Future<void> login(String token) async {
    await _store.setToken(token);
    final hasPin = (await _store.getPin()) != null;
    state = AuthState(isLoading: false, isAuthenticated: true, hasPin: hasPin);
  }

  /// Refreshes state to check if a PIN was just setup
  Future<void> refreshPinStatus() async {
    final hasPin = (await _store.getPin()) != null;
    state = state.copyWith(hasPin: hasPin);
  }

  /// Logs out by clearing only the API token, maintaining the PIN lock
  Future<void> logout() async {
    await _store.clearToken();
    final hasPin = (await _store.getPin()) != null;
    state = AuthState(isLoading: false, isAuthenticated: false, hasPin: hasPin);
  }

  /// Hard logout completely wipes all data (forgot PIN or manual full sign out)
  Future<void> clearAll() async {
    await _store.clearAll();
    state = const AuthState(isLoading: false, isAuthenticated: false, hasPin: false);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(tokenStoreProvider), ref.watch(apiServiceProvider));
});
