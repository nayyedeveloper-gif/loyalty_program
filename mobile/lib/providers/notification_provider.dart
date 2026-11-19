import 'package:flutter/foundation.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';

class NotificationProvider extends ChangeNotifier {
  NotificationProvider(this.auth);

  final AuthProvider auth;
  int unread = 0;
  int chatUnread = 0;

  int get totalUnread => unread + chatUnread;

  Future<void> refreshUnread() async {
    if (!auth.isCustomer) {
      unread = 0;
      chatUnread = 0;
      notifyListeners();
      return;
    }
    try {
      final results = await Future.wait([
        auth.api.get('/notifications/unread-count'),
        auth.api.get('/chat/unread-count'),
      ]);
      final n = results[0];
      final c = results[1];
      unread = n['count'] is int
          ? n['count'] as int
          : int.tryParse('${n['unread'] ?? n['count']}') ?? 0;
      chatUnread = c['unread_count'] is int
          ? c['unread_count'] as int
          : int.tryParse('${c['unread_count'] ?? c['count']}') ?? 0;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    await auth.api.post('/notifications/read-all');
    unread = 0;
    notifyListeners();
  }
}
