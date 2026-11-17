import 'package:flutter/foundation.dart';
import 'package:loyalty_mobile/core/storage/app_storage.dart';
import 'package:loyalty_mobile/l10n/translations.dart';

class LanguageProvider extends ChangeNotifier {
  LanguageProvider(this.storage) {
    _init();
  }

  final AppStorage storage;
  String lang = 'en';

  Future<void> _init() async {
    lang = await storage.getLang();
    notifyListeners();
  }

  Future<void> setLang(String value) async {
    lang = value;
    await storage.setLang(value);
    notifyListeners();
  }

  String t(String key, [Map<String, dynamic>? params]) =>
      translate(lang, key, params);
}
