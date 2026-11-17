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
