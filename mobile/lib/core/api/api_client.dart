import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:loyalty_mobile/core/api/api_exception.dart';
import 'package:loyalty_mobile/core/config/app_config.dart';

typedef TokenGetter = Future<String?> Function();
typedef UnauthorizedHandler = Future<void> Function();

class ApiClient {
  ApiClient({
    required this.getToken,
    this.onUnauthorized,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final TokenGetter getToken;
  final UnauthorizedHandler? onUnauthorized;
  final http.Client _client;

  Uri _uri(String path, [Map<String, dynamic>? params]) {
    final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    final normalized = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$base$normalized');
    if (params == null || params.isEmpty) return uri;
    return uri.replace(
      queryParameters: {
        ...uri.queryParameters,
        ...params.map((k, v) => MapEntry(k, '$v')),
      }..removeWhere((k, v) => v.isEmpty || v == 'null'),
    );
  }

  bool _shouldAttachAuth(String path) =>
      !path.startsWith('/spinwheel/guest');

  Future<Map<String, String>> _headers(String path, {bool json = true}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    if (_shouldAttachAuth(path)) {
      final token = await getToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? params,
    Map<String, String>? extraHeaders,
  }) =>
      _send('GET', path, params: params, extraHeaders: extraHeaders);

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, dynamic>? params,
    Map<String, String>? extraHeaders,
  }) =>
      _send('POST', path, body: body, params: params, extraHeaders: extraHeaders);

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
    Map<String, dynamic>? params,
  }) =>
      _send('PUT', path, body: body, params: params);

  Future<Map<String, dynamic>> delete(String path) =>
      _send('DELETE', path);

  /// Unwraps JSON array responses (`[{...}]` → wrapped as `{data: [...]}`).
  Future<List<Map<String, dynamic>>> getList(
    String path, {
    Map<String, dynamic>? params,
  }) async {
    final res = await get(path, params: params);
    return listFromResponse(res);
  }

  static List<Map<String, dynamic>> listFromResponse(Map<String, dynamic> res) {
    final data = res['data'];
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }

  // --- Spinwheel admin (auth:sanctum + admin only) ---

  Future<List<Map<String, dynamic>>> spinAdminWheels() =>
      getList('/spinwheel/admin/wheels');

  Future<Map<String, dynamic>> spinAdminWheel(Object id) =>
      get('/spinwheel/admin/wheels/$id');

  Future<List<Map<String, dynamic>>> spinAdminUsages({Object? userId}) =>
      getList(
        '/spinwheel/admin/usages',
        params: {if (userId != null) 'user_id': userId},
      );

  Future<Map<String, dynamic>> spinAdminGrantUsages({
    required Object userId,
    required int count,
    required int validHours,
    String source = 'manual',
  }) =>
      post('/spinwheel/admin/usages/grant', body: {
        'user_id': userId,
        'count': count,
        'valid_hours': validHours,
        'source': source,
      });

  Future<Map<String, dynamic>> spinAdminAdjustUsage(
    Object id, {
    required String status,
  }) =>
      put('/spinwheel/admin/usages/$id', body: {'status': status});

  Future<Map<String, dynamic>> spinAdminSettings() =>
      get('/spinwheel/admin/settings');

  Future<Map<String, dynamic>> spinAdminUpdateSettings(
    Map<String, dynamic> body,
  ) =>
      put('/spinwheel/admin/settings', body: body);

  Future<List<Map<String, dynamic>>> spinAdminPromos() =>
      getList('/spinwheel/admin/promos');

  Future<List<Map<String, dynamic>>> spinAdminRewards({
    String? q,
    String? audience,
    String? status,
    String? from,
    String? to,
  }) =>
      getList('/spinwheel/admin/rewards', params: {
        if (q != null && q.isNotEmpty) 'q': q,
        if (audience != null && audience.isNotEmpty && audience != 'all')
          'audience': audience,
        if (status != null && status.isNotEmpty) 'status': status,
        if (from != null && from.isNotEmpty) 'from': from,
        if (to != null && to.isNotEmpty) 'to': to,
      });

  Future<Map<String, dynamic>> spinAdminReward(Object id) =>
      get('/spinwheel/admin/rewards/$id');

  Future<Map<String, dynamic>> spinAdminClaimReward(
    Object id, {
    bool overrideExpired = false,
  }) =>
      post('/spinwheel/admin/rewards/$id/claim', body: {
        'override_expired': overrideExpired,
      });

  Future<List<Map<String, dynamic>>> spinAdminGuestSpins({
    String? q,
    String? status,
  }) =>
      getList('/spinwheel/admin/guest-spins', params: {
        if (q != null && q.isNotEmpty) 'q': q,
        if (status != null && status.isNotEmpty) 'status': status,
      });

  Future<Map<String, dynamic>> spinAdminCreateGuestSpin({int? validHours}) =>
      post('/spinwheel/admin/guest-spins', body: {
        if (validHours != null) 'valid_hours': validHours,
      });

  Future<Map<String, dynamic>> spinAdminGuestSpin(Object id) =>
      get('/spinwheel/admin/guest-spins/$id');

  Future<Map<String, dynamic>> spinAdminRevokeGuestSpin(Object id) =>
      post('/spinwheel/admin/guest-spins/$id/revoke', body: const {});

  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required String fileField,
    required String filePath,
    String filename = 'avatar.jpg',
    Map<String, String>? fields,
  }) async {
    final request = http.MultipartRequest('POST', _uri(path));
    request.headers.addAll(await _headers(path, json: false));
    if (fields != null) request.fields.addAll(fields);
    request.files.add(await http.MultipartFile.fromPath(
      fileField,
      filePath,
      filename: filename,
    ));
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    return _decode(response);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, dynamic>? params,
    Map<String, String>? extraHeaders,
  }) async {
    final headers = await _headers(path);
    if (extraHeaders != null) headers.addAll(extraHeaders);
    final uri = _uri(path, params);
    late http.Response response;
    switch (method) {
      case 'GET':
        response = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        response = await _client.post(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'PUT':
        response = await _client.put(
          uri,
          headers: headers,
          body: body == null ? null : jsonEncode(body),
        );
        break;
      case 'DELETE':
        response = await _client.delete(uri, headers: headers);
        break;
      default:
        throw ApiException(statusCode: 0, message: 'Unsupported method');
    }
    return _decode(response);
  }

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    Map<String, dynamic>? data;
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) {
          data = decoded;
        } else {
          data = {'data': decoded};
        }
      } catch (_) {
        data = {'message': response.body};
      }
    }
    data ??= <String, dynamic>{};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }

    if (response.statusCode == 401) {
      await onUnauthorized?.call();
    }

    final message = _extractMessage(data) ?? 'Request failed (${response.statusCode})';
    throw ApiException(
      statusCode: response.statusCode,
      message: message,
      errors: data['errors'] is Map<String, dynamic>
          ? data['errors'] as Map<String, dynamic>
          : null,
    );
  }

  String? _extractMessage(Map<String, dynamic> data) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    final errors = data['errors'];
    if (errors is Map && errors.isNotEmpty) {
      final first = errors.values.first;
      if (first is List && first.isNotEmpty) return '${first.first}';
      return '$first';
    }
    return null;
  }
}
