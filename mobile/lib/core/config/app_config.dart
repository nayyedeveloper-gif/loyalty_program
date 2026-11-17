import 'package:flutter/foundation.dart' show kIsWeb;

class AppConfig {
  /// Override with:
  /// `--dart-define=API_BASE_URL=http://10.0.2.2:8000/api` (Android emulator)
  /// `--dart-define=API_ORIGIN=http://10.0.2.2:8000`
  static const String _apiBaseFromEnv = String.fromEnvironment('API_BASE_URL');
  static const String _originFromEnv = String.fromEnvironment('API_ORIGIN');

  static String get apiBaseUrl {
    if (_apiBaseFromEnv.isNotEmpty) return _apiBaseFromEnv;
    // Windows / macOS / iOS simulator / Chrome → host machine
    // Android emulator needs 10.0.2.2 via dart-define
    return 'http://127.0.0.1:8000/api';
  }

  static String get mediaOrigin {
    if (_originFromEnv.isNotEmpty) return _originFromEnv;
    return 'http://127.0.0.1:8000';
  }

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
