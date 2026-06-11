import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_service.dart';
import 'token_store.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiServiceProvider = Provider<ApiService>((ref) {
  final store = ref.watch(tokenStoreProvider);
  return ApiService(store);
});

class AuthState {
  const AuthState({required this.isLoading, required this.isAuthenticated});

  final bool isLoading;
  final bool isAuthenticated;

  AuthState copyWith({bool? isLoading, bool? isAuthenticated}) => AuthState(
        isLoading: isLoading ?? this.isLoading,
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._store, this._api)
      : super(const AuthState(isLoading: true, isAuthenticated: false)) {
    _api.setUnauthorizedHandler(() {
      state = const AuthState(isLoading: false, isAuthenticated: false);
    });
    _init();
  }

  final TokenStore _store;
  final ApiService _api;

  Future<void> _init() async {
    await _store.load();
    state = AuthState(isLoading: false, isAuthenticated: _store.token != null);
  }

  Future<void> login(String token) async {
    await _store.setToken(token);
    state = const AuthState(isLoading: false, isAuthenticated: true);
  }

  Future<void> logout() async {
    await _store.clear();
    state = const AuthState(isLoading: false, isAuthenticated: false);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(tokenStoreProvider), ref.watch(apiServiceProvider));
});
