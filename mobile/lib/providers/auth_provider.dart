import 'package:flutter/foundation.dart';
import 'package:loyalty_mobile/core/api/api_client.dart';
import 'package:loyalty_mobile/core/storage/app_storage.dart';
import 'package:loyalty_mobile/models/user.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this.storage) {
    api = ApiClient(
      getToken: storage.getToken,
      onUnauthorized: () async {
        await storage.clearAuth();
        user = null;
        notifyListeners();
      },
    );
    restore();
  }

  final AppStorage storage;
  late final ApiClient api;

  User? user;
  bool loading = true;
  Map<String, dynamic>? spinGrantNotice;

  bool get isLoggedIn => user != null;
  bool get isCustomer => user?.isCustomer == true;

  Future<void> restore() async {
    loading = true;
    notifyListeners();
    try {
      final token = await storage.getToken();
      if (token == null || token.isEmpty) {
        user = null;
        return;
      }
      final data = await api.get('/auth/me');
      final map = Map<String, dynamic>.from(data['user'] as Map);
      user = User.fromJson(map);
      await storage.setUser(map);
    } catch (_) {
      await storage.clearAuth();
      user = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<User> login(String email, String password) async {
    final data = await api.post('/auth/login', body: {
      'email': email,
      'password': password,
    });
    return _acceptAuth(data);
  }

  Future<User> register(Map<String, dynamic> payload) async {
    final data = await api.post('/auth/register', body: payload);
    return _acceptAuth(data);
  }

  Future<User> _acceptAuth(Map<String, dynamic> data) async {
    final token = '${data['token']}';
    final map = Map<String, dynamic>.from(data['user'] as Map);
    await storage.setToken(token);
    await storage.setUser(map);
    user = User.fromJson(map);
    if (data['spin_grant'] is Map) {
      spinGrantNotice = Map<String, dynamic>.from(data['spin_grant'] as Map);
      await storage.setSpinGrantNotice(spinGrantNotice);
    }
    notifyListeners();
    return user!;
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    await storage.clearAuth();
    user = null;
    notifyListeners();
  }

  Future<void> changePassword({
    required String currentPassword,
    required String password,
    required String passwordConfirmation,
  }) async {
    await api.post('/auth/change-password', body: {
      'current_password': currentPassword,
      'password': password,
      'password_confirmation': passwordConfirmation,
    });
  }

  void setUserFromMap(Map<String, dynamic> map) {
    user = User.fromJson(map);
    storage.setUser(map);
    notifyListeners();
  }

  Future<Map<String, dynamic>?> consumeSpinGrantNotice() async {
    final notice = spinGrantNotice ?? await storage.getSpinGrantNotice();
    spinGrantNotice = null;
    await storage.setSpinGrantNotice(null);
    return notice;
  }
}
