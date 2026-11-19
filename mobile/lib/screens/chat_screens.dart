import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:loyalty_mobile/core/config/app_config.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/providers/notification_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

class ChatInboxScreen extends StatefulWidget {
  const ChatInboxScreen({super.key, this.conversationId});
  final int? conversationId;

  @override
  State<ChatInboxScreen> createState() => _ChatInboxScreenState();
}

class _ChatInboxScreenState extends State<ChatInboxScreen> {
  int? conversationId;
  List<Map<String, dynamic>> messages = [];
  final controller = TextEditingController();
  final scroll = ScrollController();
  bool loading = true;
  bool sending = false;
  bool deleting = false;
  String? error;
  Timer? messagePoll;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    messagePoll?.cancel();
    controller.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = context.read<AuthProvider>().api;
      if (widget.conversationId != null) {
        conversationId = widget.conversationId;
      } else {
        final opened = await api.post('/chat/conversations/open');
        final conv = Map<String, dynamic>.from(opened['conversation'] as Map);
        conversationId = conv['id'] is int ? conv['id'] as int : int.tryParse('${conv['id']}');
      }
      await _loadMessages(initial: true);
      messagePoll?.cancel();
      messagePoll = Timer.periodic(const Duration(seconds: 4), (_) => _loadMessages());
      if (mounted) context.read<NotificationProvider>().refreshUnread();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _loadMessages({bool initial = false}) async {
    final id = conversationId;
    if (id == null) return;
    try {
      final afterId = (!initial && messages.isNotEmpty)
          ? (messages.last['id'] is int ? messages.last['id'] as int : int.tryParse('${messages.last['id']}') ?? 0)
          : 0;
      final data = await context.read<AuthProvider>().api.get(
            '/chat/conversations/$id/messages',
            params: afterId > 0 ? {'after_id': afterId} : null,
          );
      final rows = (data['messages'] as List? ?? [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() {
        if (afterId > 0) {
          messages = [...messages, ...rows];
        } else {
          messages = rows;
        }
      });
      if (rows.isNotEmpty || initial) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (scroll.hasClients) {
            scroll.animateTo(
              scroll.position.maxScrollExtent + 100,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOut,
            );
          }
        });
      }
      await context.read<AuthProvider>().api.post('/chat/conversations/$id/read');
      if (mounted) context.read<NotificationProvider>().refreshUnread();
    } catch (_) {}
  }

  Future<void> _sendText() async {
    final id = conversationId;
    final text = controller.text.trim();
    if (id == null || text.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      final data = await context.read<AuthProvider>().api.post(
        '/chat/conversations/$id/messages',
        body: {'type': 'text', 'body': text},
      );
      controller.clear();
      final msg = data['message'];
      if (msg is Map) {
        setState(() => messages = [...messages, Map<String, dynamic>.from(msg)]);
      } else {
        await _loadMessages(initial: true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _sendPhoto() async {
    final id = conversationId;
    if (id == null || sending) return;
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 1600);
    if (picked == null || !mounted) return;
    setState(() => sending = true);
    try {
      final data = await context.read<AuthProvider>().api.postMultipart(
        '/chat/conversations/$id/messages',
        fileField: 'attachment',
        filePath: picked.path,
        filename: picked.name,
        fields: {'type': 'image', 'body': 'Photo'},
      );
      final msg = data['message'];
      if (msg is Map) {
        setState(() => messages = [...messages, Map<String, dynamic>.from(msg)]);
      } else {
        await _loadMessages(initial: true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> _deleteMessage(Map<String, dynamic> m) async {
    final cid = conversationId;
    final mid = m['id'] is int ? m['id'] as int : int.tryParse('${m['id']}');
    if (cid == null || mid == null || deleting) return;
    if (!_canDelete(m)) return;

    final lang = context.read<LanguageProvider>();
    final ok = await showConfirmDialog(
      context,
      title: lang.t('chatDeleteMessage'),
      message: lang.t('chatDeleteConfirm'),
      confirmLabel: lang.t('confirm'),
      cancelLabel: lang.t('cancel'),
    );
    if (!ok || !mounted) return;

    setState(() => deleting = true);
    try {
      await context.read<AuthProvider>().api.delete(
            '/chat/conversations/$cid/messages/$mid',
          );
      if (!mounted) return;
      setState(() {
        messages = messages.where((row) {
          final id = row['id'] is int ? row['id'] as int : int.tryParse('${row['id']}');
          return id != mid;
        }).toList();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => deleting = false);
    }
  }

  bool _isMine(Map<String, dynamic> m) {
    final me = context.read<AuthProvider>().user?.id;
    final sender = m['sender'];
    final sid = sender is Map ? sender['id'] : m['sender_id'];
    if (me == null || sid == null) return false;
    return '$sid' == '$me';
  }

  bool _canDelete(Map<String, dynamic> m) {
    final user = context.read<AuthProvider>().user;
    if (user == null) return false;
    return _isMine(m) || user.isStaff || user.isAdmin;
  }

  String? _attachmentUrl(Map<String, dynamic> m) {
    final path = m['attachment_url'] ?? m['attachment_path'] ?? (m['meta'] is Map ? (m['meta'] as Map)['url'] : null);
    if (path == null) return null;
    return AppConfig.mediaUrl('$path');
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final t = lang.t;
    return Scaffold(
      backgroundColor: AppPalette.of(context).background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t('supportChat')),
            Text(t('supportChatHint'), style: const TextStyle(fontSize: 12, color: AppColors.inkSoft, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
      body: loading
          ? LoadingView(label: t('loading'))
          : error != null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: ErrorBanner(message: error!, onRetry: _bootstrap),
                )
              : Column(
                  children: [
                    Expanded(
                      child: messages.isEmpty
                          ? EmptyState(message: t('supportChatEmpty'), icon: Icons.chat_bubble_outline)
                          : ListView.builder(
                              controller: scroll,
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                              itemCount: messages.length,
                              itemBuilder: (_, i) {
                                final m = messages[i];
                                final mine = _isMine(m);
                                final canDelete = _canDelete(m);
                                final body = '${m['body'] ?? ''}';
                                final imageUrl = (m['type'] == 'image') ? _attachmentUrl(m) : null;
                                return Align(
                                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                                  child: Container(
                                    constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: mine ? AppColors.primary : Colors.white,
                                      borderRadius: BorderRadius.only(
                                        topLeft: const Radius.circular(16),
                                        topRight: const Radius.circular(16),
                                        bottomLeft: Radius.circular(mine ? 16 : 4),
                                        bottomRight: Radius.circular(mine ? 4 : 16),
                                      ),
                                      border: mine ? null : Border.all(color: AppColors.line),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        if (imageUrl != null && imageUrl.isNotEmpty)
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(10),
                                            child: CachedNetworkImage(
                                              imageUrl: imageUrl,
                                              width: 180,
                                              fit: BoxFit.cover,
                                            ),
                                          ),
                                        if (body.isNotEmpty && body != 'Photo')
                                          Padding(
                                            padding: EdgeInsets.only(top: imageUrl != null ? 8 : 0),
                                            child: Text(
                                              body,
                                              style: TextStyle(
                                                color: mine ? Colors.white : AppColors.ink,
                                                fontWeight: FontWeight.w600,
                                                height: 1.35,
                                              ),
                                            ),
                                          ),
                                        if (canDelete)
                                          Align(
                                            alignment: Alignment.centerRight,
                                            child: IconButton(
                                              visualDensity: VisualDensity.compact,
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                              tooltip: t('chatDeleteMessage'),
                                              onPressed: deleting ? null : () => _deleteMessage(m),
                                              icon: Icon(
                                                Icons.delete_outline,
                                                size: 18,
                                                color: mine ? Colors.white70 : AppColors.danger,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    SafeArea(
                      top: false,
                      child: Container(
                        color: Colors.white,
                        padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: sending ? null : _sendPhoto,
                              tooltip: t('attachPhoto'),
                              icon: const Icon(Icons.photo_outlined, color: AppColors.primaryDark),
                            ),
                            Expanded(
                              child: TextField(
                                controller: controller,
                                minLines: 1,
                                maxLines: 4,
                                textInputAction: TextInputAction.send,
                                onSubmitted: (_) => _sendText(),
                                style: const TextStyle(color: AppColors.ink),
                                decoration: InputDecoration(
                                  hintText: t('typeMessage'),
                                  hintStyle: const TextStyle(color: AppColors.muted),
                                  filled: true,
                                  fillColor: AppColors.mist,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(24),
                                    borderSide: const BorderSide(color: AppColors.line),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(24),
                                    borderSide: const BorderSide(color: AppColors.line),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            FilledButton(
                              onPressed: sending ? null : _sendText,
                              style: FilledButton.styleFrom(
                                shape: const CircleBorder(),
                                padding: const EdgeInsets.all(14),
                              ),
                              child: sending
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Icon(Icons.send_rounded),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
