import 'dart:io';

import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import 'api_config.dart';
import 'api_error.dart';
import 'file_download.dart';
import '../../domain/models/import_result.dart';

/// Production API — override with --dart-define=API_URL=...
export 'api_config.dart' show kApiBaseUrl, apiBaseUrl;

typedef VoidCallback = void Function();

class ApiService {
  ApiService(this._tokenStore) {
    _dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _tokenStore.token;
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await _tokenStore.clearToken();
          _onUnauthorized?.call();
        }
        handler.next(error);
      },
    ));
  }

  final TokenStore _tokenStore;
  late final Dio _dio;
  VoidCallback? _onUnauthorized;

  void setUnauthorizedHandler(VoidCallback handler) => _onUnauthorized = handler;

  static const _importExportTimeout = Duration(seconds: 120);

  ApiError _mapHttpError(int status, String fallback) {
    if (status == 404) {
      return ApiError(
        status,
        'This feature is not available on the server yet. '
        'Deploy the latest API, or rebuild the app with your local API URL '
        '(flutter build apk --dart-define=API_URL=http://YOUR_PC_IP:4000).',
      );
    }
    if (status == 401) return ApiError(status, 'Session expired. Please sign in again.');
    if (status >= 500) return ApiError(status, 'Server error. Please try again in a moment.');
    return ApiError(status, fallback);
  }

  ApiError _dioError(DioException e, String fallback) {
    final status = e.response?.statusCode ?? 0;
    final body = e.response?.data;
    if (body is Map) {
      final errors = body['errors'];
      if (errors is List && errors.isNotEmpty) {
        return ApiError(status, errors.map((x) => '$x').join('\n'));
      }
      final msg = body['error'] ?? body['message'];
      if (msg != null) return ApiError(status, msg.toString());
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return ApiError(status, 'Request timed out. Please try again.');
    }
    if (e.type == DioExceptionType.connectionError) {
      return ApiError(status, 'Network error — check your internet connection.');
    }
    if (status == 404 || (e.message?.contains('404') ?? false)) {
      return _mapHttpError(404, fallback);
    }
    return ApiError(status, fallback);
  }

  String _filenameFromDisposition(String? disposition, String fallback) {
    if (disposition == null) return fallback;
    final match = RegExp(r'filename="?([^";]+)"?').firstMatch(disposition);
    return match?.group(1) ?? fallback;
  }

  Future<List<int>> _downloadBytes(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final res = await _dio.get<List<int>>(
        path,
        queryParameters: queryParameters,
        options: Options(
          responseType: ResponseType.bytes,
          receiveTimeout: _importExportTimeout,
          connectTimeout: _importExportTimeout,
        ),
      );
      final data = res.data;
      if (data == null || data.isEmpty) {
        throw ApiError(res.statusCode ?? 0, 'Empty file received from server');
      }
      return data;
    } on DioException catch (e) {
      throw _dioError(e, 'Download failed');
    }
  }

  Future<T> _request<T>(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? parser,
  }) async {
    try {
      final res = await _dio.request<dynamic>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: Options(method: method),
      );
      if (res.statusCode == 204) return null as T;
      final body = res.data;
      if (parser != null) return parser(body);
      return body as T;
    } on DioException catch (e) {
      final status = e.response?.statusCode ?? 0;
      final body = e.response?.data;
      if (body is Map && body['error'] != null) {
        throw ApiError(status, body['error'].toString());
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw ApiError(status, 'Request timed out. Check that the API is running.');
      }
      if (e.type == DioExceptionType.connectionError) {
        throw ApiError(status, 'Network error — is the API running?');
      }
      if (status == 404) throw _mapHttpError(404, 'Request failed');
      throw ApiError(status, 'Request failed ($status)');
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> login(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/auth/login', data: data);

  // ── Health ────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> health() => _request('GET', '/health');

  // ── Months ────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getMonths({int page = 1, int limit = 12}) =>
      _request('GET', '/api/v1/months', queryParameters: {'page': page, 'limit': limit});

  Future<Map<String, dynamic>> createMonth(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/months', data: data);

  Future<Map<String, dynamic>> getMonth(String id) =>
      _request('GET', '/api/v1/months/$id');

  Future<Map<String, dynamic>> updateMonth(String id, Map<String, dynamic> data) =>
      _request('PATCH', '/api/v1/months/$id', data: data);

  Future<Map<String, dynamic>> getDashboard(String monthId) =>
      _request('GET', '/api/v1/months/$monthId/dashboard');

  // ── Today ─────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getToday({String? date}) => _request(
        'GET',
        '/api/v1/today',
        queryParameters: date != null ? {'date': date} : null,
      );

  // ── Inventory / Products ──────────────────────────────────────────────────
  Future<Map<String, dynamic>> getProducts({
    int page = 1,
    String? search,
    String? kind,
    int limit = 50,
    List<String>? excludeKinds,
    Map<String, String>? filters,
  }) {
    final q = <String, dynamic>{'page': page, 'limit': limit};
    if (search != null) q['search'] = search;
    if (kind != null) q['kind'] = kind;
    if (excludeKinds != null && excludeKinds.isNotEmpty) {
      q['excludeKinds'] = excludeKinds.join(',');
    }
    filters?.forEach((k, v) => q[k] = v);
    return _request('GET', '/api/v1/inventory/products', queryParameters: q);
  }

  Future<Map<String, dynamic>> getPhoneModels() =>
      _request('GET', '/api/v1/inventory/phone-models');

  Future<Map<String, dynamic>> createPhoneModel(String name) =>
      _request('POST', '/api/v1/inventory/phone-models', data: {'name': name});

  Future<Map<String, dynamic>> getCoverTypes({String? phoneModelId}) => _request(
        'GET',
        '/api/v1/inventory/cover-types',
        queryParameters: phoneModelId != null ? {'phoneModelId': phoneModelId} : null,
      );

  Future<Map<String, dynamic>> createCoverType(String phoneModelId, String name) =>
      _request('POST', '/api/v1/inventory/cover-types',
          data: {'phoneModelId': phoneModelId, 'name': name});

  Future<Map<String, dynamic>> getCoverProductStats() =>
      _request('GET', '/api/v1/inventory/products/covers-stats');

  Future<Map<String, dynamic>> createProduct(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/inventory/products', data: data);

  Future<Map<String, dynamic>> batchCreateCovers(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/inventory/products/batch-covers', data: data);

  Future<Map<String, dynamic>> getProduct(String id) =>
      _request('GET', '/api/v1/inventory/products/$id');

  Future<Map<String, dynamic>> scanProduct(String code) =>
      _request('GET', '/api/v1/inventory/products/scan/${Uri.encodeComponent(code)}');

  Future<Map<String, dynamic>> updateProduct(String id, Map<String, dynamic> data) =>
      _request('PATCH', '/api/v1/inventory/products/$id', data: data);

  Future<void> deleteProduct(String id) =>
      _request('DELETE', '/api/v1/inventory/products/$id');

  Future<Map<String, dynamic>> stockIn(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/inventory/stock/in', data: data);

  Future<Map<String, dynamic>> getCategories() =>
      _request('GET', '/api/v1/inventory/categories');

  Future<Map<String, dynamic>> createCategory(String name) =>
      _request('POST', '/api/v1/inventory/categories', data: {'name': name});

  Future<Map<String, dynamic>> getLowStock() =>
      _request('GET', '/api/v1/inventory/products/low-stock');

  // ── Sales ─────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getSales({int page = 1, String? date}) => _request(
        'GET',
        '/api/v1/inventory/sales',
        queryParameters: {'page': page, 'limit': 50, if (date != null) 'date': date},
      );

  Future<Map<String, dynamic>> createSale(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/inventory/sales', data: data);

  Future<void> deleteSale(String saleId) =>
      _request('DELETE', '/api/v1/inventory/sales/$saleId');

  Future<Map<String, dynamic>> getSaleInvoice(String saleId) =>
      _request('GET', '/api/v1/inventory/sales/$saleId/invoice');

  Future<Map<String, dynamic>> getInvoiceSettings() =>
      _request('GET', '/api/v1/settings/invoice');

  Future<Map<String, dynamic>> updateInvoiceSettings(Map<String, dynamic> data) =>
      _request('PUT', '/api/v1/settings/invoice', data: data);

  // ── Purchases ─────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getPurchases({int page = 1, String? date, String? partyId}) =>
      _request('GET', '/api/v1/purchases', queryParameters: {
        'page': page,
        'limit': 50,
        if (date != null) 'date': date,
        if (partyId != null) 'partyId': partyId,
      });

  Future<Map<String, dynamic>> getPurchase(String id) =>
      _request('GET', '/api/v1/purchases/$id');

  Future<Map<String, dynamic>> createPurchase(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/purchases', data: data);

  Future<Map<String, dynamic>> addPurchasePayment(String id, Map<String, dynamic> data) =>
      _request('POST', '/api/v1/purchases/$id/payments', data: data);

  // ── Recharge ──────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getRechargeEntries(
    String monthId, {
    int page = 1,
    String? date,
    int limit = 50,
  }) =>
      _request('GET', '/api/v1/months/$monthId/recharge-entries', queryParameters: {
        'page': page,
        'limit': limit,
        if (date != null) 'date': date,
      });

  Future<Map<String, dynamic>> createRechargeEntry(
          String monthId, Map<String, dynamic> data) =>
      _request('POST', '/api/v1/months/$monthId/recharge-entries', data: data);

  Future<Map<String, dynamic>> updateRechargeEntry(
    String monthId,
    String entryId,
    Map<String, dynamic> data,
  ) =>
      _request('PATCH', '/api/v1/months/$monthId/recharge-entries/$entryId', data: data);

  Future<void> deleteRechargeEntry(String monthId, String entryId) =>
      _request('DELETE', '/api/v1/months/$monthId/recharge-entries/$entryId');

  // ── Transfer ────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getTransferEntries(
    String monthId, {
    int page = 1,
    String? date,
  }) =>
      _request('GET', '/api/v1/months/$monthId/transfer-entries', queryParameters: {
        'page': page,
        'limit': 50,
        if (date != null) 'date': date,
      });

  Future<Map<String, dynamic>> createTransferEntry(
          String monthId, Map<String, dynamic> data) =>
      _request('POST', '/api/v1/months/$monthId/transfer-entries', data: data);

  Future<Map<String, dynamic>> updateTransferEntry(
    String monthId,
    String entryId,
    Map<String, dynamic> data,
  ) =>
      _request('PATCH', '/api/v1/months/$monthId/transfer-entries/$entryId', data: data);

  Future<void> deleteTransferEntry(String monthId, String entryId) =>
      _request('DELETE', '/api/v1/months/$monthId/transfer-entries/$entryId');

  // ── Repair ──────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getRepairJobs(
    String monthId, {
    int page = 1,
    String? date,
    String? status,
  }) =>
      _request('GET', '/api/v1/months/$monthId/repair-jobs', queryParameters: {
        'page': page,
        'limit': 50,
        if (date != null) 'date': date,
        if (status != null) 'status': status,
      });

  Future<Map<String, dynamic>> createRepairIntake(
          String monthId, Map<String, dynamic> data) =>
      _request('POST', '/api/v1/months/$monthId/repair-jobs/intake', data: data);

  Future<Map<String, dynamic>> createRepairJob(
          String monthId, Map<String, dynamic> data) =>
      _request('POST', '/api/v1/months/$monthId/repair-jobs', data: data);

  Future<Map<String, dynamic>> updateRepairJob(
    String monthId,
    String jobId,
    Map<String, dynamic> data,
  ) =>
      _request('PATCH', '/api/v1/months/$monthId/repair-jobs/$jobId', data: data);

  Future<void> deleteRepairJob(String monthId, String jobId) =>
      _request('DELETE', '/api/v1/months/$monthId/repair-jobs/$jobId');

  Future<Map<String, dynamic>> getRepairJob(String monthId, String jobId) =>
      _request('GET', '/api/v1/months/$monthId/repair-jobs/$jobId');

  // ── Expenses ────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getShopExpenses(
    String monthId, {
    int page = 1,
    int limit = 31,
    String? from,
    String? to,
  }) =>
      _request('GET', '/api/v1/months/$monthId/shop-expenses', queryParameters: {
        'page': page,
        'limit': limit,
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      });

  Future<Map<String, dynamic>> getDamages(
    String monthId, {
    int page = 1,
    int limit = 31,
    String? from,
    String? to,
  }) =>
      _request('GET', '/api/v1/months/$monthId/damages', queryParameters: {
        'page': page,
        'limit': limit,
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      });

  Future<Map<String, dynamic>> getWithdrawals(
    String monthId, {
    int page = 1,
    int limit = 31,
    String? from,
    String? to,
  }) =>
      _request('GET', '/api/v1/months/$monthId/withdrawals', queryParameters: {
        'page': page,
        'limit': limit,
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      });

  Future<Map<String, dynamic>> createExpenseEntry(
          String monthId, Map<String, dynamic> body) =>
      _request('POST', '/api/v1/months/$monthId/expenses/entry', data: body);

  Future<Map<String, dynamic>> updateExpenseEntry(
          String monthId, Map<String, dynamic> body) =>
      _request('POST', '/api/v1/months/$monthId/expenses/entry/update', data: body);

  Future<void> deleteExpenseEntry(String monthId, Map<String, dynamic> body) =>
      _request('POST', '/api/v1/months/$monthId/expenses/entry/delete', data: body);

  Future<Map<String, dynamic>> createWithdrawal(
          String monthId, Map<String, dynamic> body) =>
      _request('POST', '/api/v1/months/$monthId/withdrawals', data: body);

  Future<Map<String, dynamic>> updateWithdrawal(
    String monthId,
    String withdrawalId,
    Map<String, dynamic> body,
  ) =>
      _request('PATCH', '/api/v1/months/$monthId/withdrawals/$withdrawalId', data: body);

  Future<void> deleteWithdrawal(String monthId, String withdrawalId) =>
      _request('DELETE', '/api/v1/months/$monthId/withdrawals/$withdrawalId');

  // ── Parties ─────────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getPartyList() => _request('GET', '/api/v1/parties');

  Future<Map<String, dynamic>> createParty(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/parties', data: data);

  Future<Map<String, dynamic>> getPartyTransactions(String monthId, {int page = 1}) =>
      _request('GET', '/api/v1/months/$monthId/party-transactions',
          queryParameters: {'page': page, 'limit': 50});

  Future<Map<String, dynamic>> createPartyTransaction(
          String monthId, Map<String, dynamic> data) =>
      _request('POST', '/api/v1/months/$monthId/party-transactions', data: data);

  Future<void> deletePartyTransaction(String monthId, String txId) =>
      _request('DELETE', '/api/v1/months/$monthId/party-transactions/$txId');

  // ── Notifications ───────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> getNotifications({int page = 1, int limit = 20}) =>
      _request('GET', '/api/v1/notifications', queryParameters: {'page': page, 'limit': limit});

  Future<Map<String, dynamic>> markNotificationRead(String id) =>
      _request('PATCH', '/api/v1/notifications/$id/read');

  Future<void> markAllNotificationsRead() =>
      _request('PATCH', '/api/v1/notifications/read-all');

  Future<Map<String, dynamic>> registerPushDevice(Map<String, dynamic> data) =>
      _request('POST', '/api/v1/notifications/devices', data: data);

  // ── Import / Export ───────────────────────────────────────────────────────────
  Future<ImportResult> importExcel(
    File file,
    int year,
    int month, {
    bool dryRun = false,
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.path.split(Platform.pathSeparator).last,
      ),
      'year': year,
      'month': month,
      if (dryRun) 'dryRun': 'true',
    });
    final path = dryRun ? '/api/v1/import/excel?dryRun=true' : '/api/v1/import/excel';
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        path,
        data: form,
        options: Options(
          contentType: 'multipart/form-data',
          receiveTimeout: _importExportTimeout,
          connectTimeout: _importExportTimeout,
        ),
      );
      return ImportResult.fromJson(res.data ?? {});
    } on DioException catch (e) {
      final status = e.response?.statusCode ?? 0;
      final body = e.response?.data;
      if (body is Map<String, dynamic>) {
        final result = ImportResult.fromJson(body);
        if (result.hasErrors) {
          throw ApiError(status, result.errors.join('\n'));
        }
      }
      throw _dioError(e, 'Import failed');
    }
  }

  Future<String> downloadImportTemplate() async {
    final bytes = await _downloadBytes('/api/v1/import/template');
    return saveBytesToTempFile(bytes, 'sk-mobile-import-template.xlsx');
  }

  Future<String> downloadExportExcel({
    int? year,
    int? month,
    String? date,
  }) async {
    final query = <String, dynamic>{};
    String fallback;
    if (date != null && date.isNotEmpty) {
      query['date'] = date;
      fallback = 'sk-mobile-day-$date.xlsx';
    } else if (year != null && month != null) {
      query['year'] = year;
      query['month'] = month;
      fallback = 'sk-mobile-$year-${month.toString().padLeft(2, '0')}.xlsx';
    } else {
      throw ApiError(400, 'Select month or date for export');
    }

    try {
      final res = await _dio.get<List<int>>(
        '/api/v1/export/excel',
        queryParameters: query,
        options: Options(
          responseType: ResponseType.bytes,
          receiveTimeout: _importExportTimeout,
          connectTimeout: _importExportTimeout,
        ),
      );
      final data = res.data;
      if (data == null || data.isEmpty) {
        throw ApiError(res.statusCode ?? 0, 'Empty export file received');
      }
      final filename = _filenameFromDisposition(
        res.headers.value('content-disposition'),
        fallback,
      );
      return saveBytesToTempFile(data, filename);
    } on DioException catch (e) {
      throw _dioError(e, 'Export failed');
    }
  }
}
