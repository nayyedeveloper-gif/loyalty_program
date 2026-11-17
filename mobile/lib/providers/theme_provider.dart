import 'package:flutter/material.dart';
import 'package:loyalty_mobile/core/storage/app_storage.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeProvider(this.storage) {
    _init();
  }

  final AppStorage storage;
  ThemeMode mode = ThemeMode.system;

  Future<void> _init() async {
    final raw = await storage.getTheme();
    mode = switch (raw) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    notifyListeners();
  }

  Future<void> setMode(ThemeMode value) async {
    mode = value;
    final key = switch (value) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      _ => 'system',
    };
    await storage.setTheme(key);
    notifyListeners();
  }
}
