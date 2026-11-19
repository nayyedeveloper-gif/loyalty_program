import 'package:flutter/foundation.dart' show kIsWeb;

class AppConfig {
  /// Override when needed:
  /// `--dart-define=API_BASE_URL=http://10.0.2.2:8000/api`
  /// `--dart-define=API_ORIGIN=http://10.0.2.2:8000`
  ///
  /// Default: production membership API (deployed MySQL / same data as the website).
  static const String _apiBaseFromEnv = String.fromEnvironment('API_BASE_URL');
  static const String _originFromEnv = String.fromEnvironment('API_ORIGIN');

  static const String productionOrigin = 'https://loyalty.29jewellery.com';
  static const String productionApiBase = '$productionOrigin/api';

  static String get apiBaseUrl {
    if (_apiBaseFromEnv.isNotEmpty) return _apiBaseFromEnv;
    return productionApiBase;
  }

  static String get mediaOrigin {
    if (_originFromEnv.isNotEmpty) return _originFromEnv;
    return productionOrigin;
  }

  static bool get isProductionApi =>
      apiBaseUrl.contains('loyalty.29jewellery.com');

  static bool get isWeb => kIsWeb;

  static String mediaUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http://') ||
        path.startsWith('https://') ||
        path.startsWith('blob:') ||
        path.startsWith('data:')) {
      return path;
    }
    final normalized = path.startsWith('/') ? path : '/$path';
    return '$mediaOrigin$normalized';
  }
}
