import 'package:flutter/foundation.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';

class NotificationProvider extends ChangeNotifier {
  NotificationProvider(this.auth);

  final AuthProvider auth;
  int unread = 0;

  Future<void> refreshUnread() async {
    if (!auth.isCustomer) {
      unread = 0;
      notifyListeners();
      return;
    }
    try {
      final data = await auth.api.get('/notifications/unread-count');
      unread = data['count'] is int
          ? data['count'] as int
          : int.tryParse('${data['unread'] ?? data['count']}') ?? 0;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    await auth.api.post('/notifications/read-all');
    unread = 0;
    notifyListeners();
  }
}
