import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AppStorage {
  SharedPreferences? _prefs;

  Future<SharedPreferences> get _p async =>
      _prefs ??= await SharedPreferences.getInstance();

  Future<String?> getToken() async => (await _p).getString('token');
  Future<void> setToken(String? value) async {
    final p = await _p;
    if (value == null) {
      await p.remove('token');
    } else {
      await p.setString('token', value);
    }
  }

  Future<Map<String, dynamic>?> getUser() async {
    final raw = (await _p).getString('user');
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> setUser(Map<String, dynamic>? user) async {
    final p = await _p;
    if (user == null) {
      await p.remove('user');
    } else {
      await p.setString('user', jsonEncode(user));
    }
  }

  Future<String> getLang() async => (await _p).getString('lang') ?? 'en';
  Future<void> setLang(String lang) async => (await _p).setString('lang', lang);

  Future<String> getTheme() async => (await _p).getString('theme') ?? 'system';
  Future<void> setTheme(String theme) async =>
      (await _p).setString('theme', theme);

  Future<Map<String, dynamic>?> getSpinGrantNotice() async {
    final raw = (await _p).getString('spin_grant_notice');
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> setSpinGrantNotice(Map<String, dynamic>? notice) async {
    final p = await _p;
    if (notice == null) {
      await p.remove('spin_grant_notice');
    } else {
      await p.setString('spin_grant_notice', jsonEncode(notice));
    }
  }

  Future<String?> getPendingSpin(int userId) async =>
      (await _p).getString('pending_spin_$userId');

  Future<void> setPendingSpin(int userId, String? key) async {
    final p = await _p;
    final name = 'pending_spin_$userId';
    if (key == null) {
      await p.remove(name);
    } else {
      await p.setString(name, key);
    }
  }

  Future<String?> getGuestSession(String token) async =>
      (await _p).getString('guest_spin_session_$token');

  Future<void> setGuestSession(String token, String? session) async {
    final p = await _p;
    final name = 'guest_spin_session_$token';
    if (session == null) {
      await p.remove(name);
    } else {
      await p.setString(name, session);
    }
  }

  Future<void> clearAuth() async {
    final p = await _p;
    await p.remove('token');
    await p.remove('user');
  }
}
