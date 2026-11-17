import 'package:flutter/foundation.dart';
import 'package:loyalty_mobile/core/api/api_client.dart';
import 'package:loyalty_mobile/models/models.dart';

class AppSettingsProvider extends ChangeNotifier {
  AppSettingsProvider(this.api) {
    load();
  }

  final ApiClient api;
  AppBranding branding = AppBranding();
  bool loading = true;

  Future<void> load() async {
    loading = true;
    notifyListeners();
    try {
      final data = await api.get('/settings/app');
      final settings = data['settings'] is Map
          ? Map<String, dynamic>.from(data['settings'] as Map)
          : data;
      branding = AppBranding.fromJson(settings);
    } catch (_) {
      branding = AppBranding();
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
