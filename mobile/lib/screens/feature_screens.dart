import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:loyalty_mobile/core/config/app_config.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/core/utils/formatters.dart';
import 'package:loyalty_mobile/models/models.dart';
import 'package:loyalty_mobile/providers/app_settings_provider.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/providers/notification_provider.dart';
import 'package:loyalty_mobile/providers/theme_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});
  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> with SingleTickerProviderStateMixin {
  late final tab = TabController(length: 2, vsync: this);
  List<RewardItem> rewards = [];
  List<Redemption> redemptions = [];
  num balance = 0;
  bool loading = true;
  String? error;
  String? message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = context.read<AuthProvider>().api;
      final results = await Future.wait([
        api.get('/customer/rewards'),
        api.get('/customer/membership'),
        api.get('/customer/redemptions', params: {'per_page': 20}),
      ]);
      setState(() {
        rewards = parseList(results[0]['rewards'], RewardItem.fromJson);
        balance = (results[1]['membership'] as Map?)?['redeemable_points'] is num
            ? (results[1]['membership'] as Map)['redeemable_points'] as num
            : 0;
        redemptions = parseList(results[2]['redemptions'], Redemption.fromJson);
      });
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _redeem(RewardItem item) async {
    final t = context.read<LanguageProvider>().t;
    final ok = await showConfirmDialog(context, title: t('redeem'), message: t('confirmRedeem'));
    if (!ok || !mounted) return;
    try {
      final data = await context.read<AuthProvider>().api.post('/customer/rewards/redeem', body: {
        'reward_item_id': item.id,
      });
      final instant = item.isInstant;
      setState(() => message = instant ? t('rewardRedeemedInstant') : t('rewardRedeemedPickup'));
      final code = (data['redemption'] as Map?)?['redemption_code'];
      if (code != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$code')));
      }
      await _load();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    }
  }

  Future<void> _cancel(Redemption item) async {
    final t = context.read<LanguageProvider>().t;
    final ok = await showConfirmDialog(context, title: t('cancel'), message: t('confirmCancelRedemption'));
    if (!ok || !mounted) return;
    try {
      await context.read<AuthProvider>().api.post('/customer/redemptions/${item.id}/cancel');
      setState(() => message = t('redemptionCancelledRefund'));
      await _load();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(
        title: Text(t('rewards')),
        bottom: TabBar(controller: tab, tabs: [Tab(text: t('catalog')), Tab(text: t('myRedemptions'))]),
      ),
      body: loading
          ? const LoadingView()
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text('${t('balance')}: ${formatPoints(balance)} ${t('points')}'),
                ),
                if (error != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: ErrorBanner(message: error!)),
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(message!, style: const TextStyle(color: Colors.green)),
                  ),
                Expanded(
                  child: TabBarView(
                    controller: tab,
                    children: [
                      rewards.isEmpty
                          ? EmptyState(message: t('noRewards'))
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.builder(
                                padding: const EdgeInsets.all(12),
                                itemCount: rewards.length,
                                itemBuilder: (_, i) {
                                  final r = rewards[i];
                                  return Card(
                                    child: ListTile(
                                      leading: r.imageUrl == null
                                          ? const Icon(Icons.card_giftcard)
                                          : ClipRRect(
                                              borderRadius: BorderRadius.circular(8),
                                              child: CachedNetworkImage(
                                                imageUrl: AppConfig.mediaUrl(r.imageUrl),
                                                width: 48,
                                                height: 48,
                                                fit: BoxFit.cover,
                                              ),
                                            ),
                                      title: Text(r.name),
                                      subtitle: Text(t('pointsCost', {'points': formatPoints(r.pointsCost)})),
                                      trailing: FilledButton(
                                        onPressed: balance >= r.pointsCost ? () => _redeem(r) : null,
                                        child: Text(t('redeem')),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                      redemptions.isEmpty
                          ? EmptyState(message: t('noRedemptions'))
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: redemptions.length,
                              itemBuilder: (_, i) {
                                final r = redemptions[i];
                                return Card(
                                  child: ListTile(
                                    title: Text(r.rewardItem?.name ?? r.redemptionCode ?? '#${r.id}'),
                                    subtitle: Text('${r.status} · ${r.redemptionCode ?? ''}'),
                                    trailing: r.canCancel
                                        ? TextButton(onPressed: () => _cancel(r), child: Text(t('cancel')))
                                        : null,
                                  ),
                                );
                              },
                            ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class MissionsScreen extends StatefulWidget {
  const MissionsScreen({super.key});
  @override
  State<MissionsScreen> createState() => _MissionsScreenState();
}

class _MissionsScreenState extends State<MissionsScreen> {
  List<Mission> items = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/missions');
      setState(() => items = parseList(data['missions'], Mission.fromJson));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('missions'))),
      body: loading
          ? const LoadingView()
          : error != null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
              : items.isEmpty
                  ? EmptyState(message: t('noMissions'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final m = items[i];
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(m.title, style: Theme.of(context).textTheme.titleMedium),
                                if (m.description != null) Text(m.description!),
                                const SizedBox(height: 8),
                                LinearProgressIndicator(value: m.progressRatio),
                                const SizedBox(height: 6),
                                Text('${formatPoints(m.progress)} / ${formatPoints(m.goalTarget)} · +${formatPoints(m.bonusPoints)} ${t('points')}'),
                                Text(m.status),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class CommunityScreen extends StatelessWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final user = context.watch<AuthProvider>().user;
    final code = user?.referralCode ?? '';
    return Scaffold(
      appBar: AppBar(title: Text(t('community'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionHeader(title: t('shareReferral'), subtitle: t('referralHint')),
          Card(
            child: ListTile(
              title: Text(code.isEmpty ? '—' : code),
              subtitle: Text(t('referralCode')),
              trailing: IconButton(
                icon: const Icon(Icons.copy),
                onPressed: code.isEmpty
                    ? null
                    : () {
                        Clipboard.setData(ClipboardData(text: code));
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('copied'))));
                      },
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: code.isEmpty
                ? null
                : () => SharePlus.instance.share(ShareParams(text: 'Join 29 Gold & Jewellery with my code: $code')),
            icon: const Icon(Icons.share),
            label: Text(t('share')),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: code.isEmpty
                ? null
                : () => launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent('Join 29 Gold with code $code')}')),
            icon: const Icon(Icons.chat),
            label: const Text('WhatsApp'),
          ),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.rate_review_outlined),
            title: Text(t('reviews')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/app/reviews'),
          ),
        ],
      ),
    );
  }
}

class ReviewsScreen extends StatefulWidget {
  const ReviewsScreen({super.key, this.productCode, this.productName});
  final String? productCode;
  final String? productName;
  @override
  State<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends State<ReviewsScreen> {
  List<ProductReview> items = [];
  bool loading = true;
  String? error;
  late final code = TextEditingController(text: widget.productCode ?? '');
  late final name = TextEditingController(text: widget.productName ?? '');
  final body = TextEditingController();
  int rating = 5;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    code.dispose();
    name.dispose();
    body.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/reviews');
      setState(() => items = parseList(data['reviews'], ProductReview.fromJson));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _submit() async {
    try {
      await context.read<AuthProvider>().api.post('/customer/reviews', body: {
        'product_code': code.text.trim(),
        'product_name': name.text.trim(),
        'rating': rating,
        'body': body.text.trim(),
      });
      body.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<LanguageProvider>().t('success'))),
        );
      }
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('reviews'))),
      body: loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (error != null) ErrorBanner(message: error!),
                SectionHeader(title: t('writeReview')),
                TextField(controller: code, decoration: InputDecoration(labelText: t('productCode'))),
                const SizedBox(height: 8),
                TextField(controller: name, decoration: InputDecoration(labelText: t('productName'))),
                const SizedBox(height: 8),
                Row(
                  children: List.generate(
                    5,
                    (i) => IconButton(
                      onPressed: () => setState(() => rating = i + 1),
                      icon: Icon(i < rating ? Icons.star : Icons.star_border, color: Colors.amber),
                    ),
                  ),
                ),
                TextField(controller: body, maxLines: 3, decoration: InputDecoration(labelText: t('reviewBody'))),
                const SizedBox(height: 8),
                FilledButton(onPressed: _submit, child: Text(t('submit'))),
                const Divider(height: 32),
                if (items.isEmpty)
                  EmptyState(message: t('noReviews'))
                else
                  ...items.map((r) => Card(
                        child: ListTile(
                          title: Text(r.productName ?? r.productCode),
                          subtitle: Text(r.body ?? ''),
                          trailing: Text('${r.rating}★'),
                        ),
                      )),
              ],
            ),
    );
  }
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> items = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/notifications');
      setState(() => items = parseList(data['notifications'] ?? data['data'] ?? data, AppNotification.fromJson));
      await context.read<NotificationProvider>().markAllRead();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('notifications'))),
      body: loading
          ? const LoadingView()
          : error != null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
              : items.isEmpty
                  ? EmptyState(message: t('noNotifications'), icon: Icons.notifications_none)
                  : ListView.separated(
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final n = items[i];
                        return ListTile(
                          leading: Icon(n.isUnread ? Icons.mark_email_unread : Icons.mark_email_read),
                          title: Text(n.title, style: TextStyle(fontWeight: n.isUnread ? FontWeight.w700 : FontWeight.w400)),
                          subtitle: Text(n.body ?? ''),
                        );
                      },
                    ),
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final lang = context.watch<LanguageProvider>();
    final theme = context.watch<ThemeProvider>();
    final user = context.watch<AuthProvider>().user;
    return Scaffold(
      appBar: AppBar(title: Text(t('settings'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(14),
              leading: CircleAvatar(
                radius: 28,
                backgroundImage: user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty
                    ? CachedNetworkImageProvider(AppConfig.mediaUrl(user.avatarUrl))
                    : null,
                backgroundColor: AppColors.primarySoft,
                child: user?.avatarUrl == null || user!.avatarUrl!.isEmpty
                    ? Text((user?.name.isNotEmpty == true ? user!.name[0] : '?').toUpperCase(),
                        style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primaryDark))
                    : null,
              ),
              title: Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(user?.email ?? ''),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/app/settings/profile'),
            ),
          ),
          const SizedBox(height: 12),
          SettingsTile(icon: Icons.lock_outline, title: t('changePassword'), onTap: () => context.push('/app/settings/password')),
          SettingsTile(
            icon: Icons.language,
            title: t('language'),
            subtitle: lang.lang == 'my' ? t('burmese') : t('english'),
            onTap: () => lang.setLang(lang.lang == 'en' ? 'my' : 'en'),
          ),
          SettingsTile(
            icon: Icons.palette_outlined,
            title: t('theme'),
            subtitle: switch (theme.mode) {
              ThemeMode.light => t('lightMode'),
              ThemeMode.dark => t('darkMode'),
              _ => t('systemMode'),
            },
            onTap: () {
              final next = switch (theme.mode) {
                ThemeMode.system => ThemeMode.light,
                ThemeMode.light => ThemeMode.dark,
                ThemeMode.dark => ThemeMode.system,
              };
              theme.setMode(next);
            },
          ),
          SettingsTile(icon: Icons.help_outline, title: t('faq'), onTap: () => context.push('/app/settings/faq')),
          SettingsTile(icon: Icons.info_outline, title: t('about'), onTap: () => context.push('/app/settings/about')),
          SettingsTile(icon: Icons.support_agent, title: t('helpFeedback'), onTap: () => context.push('/app/help')),
          SettingsTile(
            icon: Icons.delete_outline,
            title: t('deleteAccount'),
            danger: true,
            onTap: () async {
              final ok = await showConfirmDialog(
                context,
                title: t('deleteAccount'),
                message: t('deleteAccountConfirm'),
                confirmLabel: t('deleteAccount'),
                cancelLabel: t('cancel'),
              );
              if (!ok || !context.mounted) return;
              try {
                await context.read<AuthProvider>().api.delete('/settings/account');
                await context.read<AuthProvider>().logout();
                if (context.mounted) context.go('/landing');
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
                }
              }
            },
          ),
          SettingsTile(
            icon: Icons.logout,
            title: t('signOut'),
            danger: true,
            onTap: () async {
              await context.read<AuthProvider>().logout();
              if (context.mounted) context.go('/landing');
            },
          ),
        ],
      ),
    );
  }
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final TextEditingController name;
  late final TextEditingController phone;
  late final TextEditingController address;
  late final TextEditingController dob;
  bool busy = false;
  bool ready = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    name = TextEditingController(text: user?.name ?? '');
    phone = TextEditingController(text: user?.phone ?? '');
    address = TextEditingController(text: user?.address ?? '');
    dob = TextEditingController(text: user?.dateOfBirth ?? '');
    ready = true;
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    address.dispose();
    dob.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final data = await context.read<AuthProvider>().api.put('/settings/profile', body: {
        'name': name.text.trim(),
        'phone': phone.text.trim(),
        'address': address.text.trim(),
        'date_of_birth': dob.text.trim().isEmpty ? null : dob.text.trim(),
      });
      if (data['user'] is Map) {
        context.read<AuthProvider>().setUserFromMap(Map<String, dynamic>.from(data['user'] as Map));
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<LanguageProvider>().t('success'))),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _pickAvatar() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null || !mounted) return;
    try {
      final data = await context.read<AuthProvider>().api.postMultipart(
            '/settings/avatar',
            fileField: 'avatar',
            filePath: file.path,
            filename: file.name,
          );
      if (data['user'] is Map) {
        context.read<AuthProvider>().setUserFromMap(Map<String, dynamic>.from(data['user'] as Map));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('editProfile'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: TextButton.icon(onPressed: _pickAvatar, icon: const Icon(Icons.camera_alt), label: const Text('Avatar')),
          ),
          TextField(controller: name, decoration: InputDecoration(labelText: t('fullName'))),
          const SizedBox(height: 8),
          TextField(controller: phone, decoration: InputDecoration(labelText: t('phone'))),
          const SizedBox(height: 8),
          TextField(controller: address, decoration: InputDecoration(labelText: t('address'))),
          const SizedBox(height: 8),
          TextField(controller: dob, decoration: InputDecoration(labelText: '${t('dateOfBirth')} (YYYY-MM-DD)')),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : _save, child: Text(busy ? t('updating') : t('save'))),
        ],
      ),
    );
  }
}

class PasswordScreen extends StatefulWidget {
  const PasswordScreen({super.key});
  @override
  State<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<PasswordScreen> {
  final current = TextEditingController();
  final next = TextEditingController();
  final confirm = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    current.dispose();
    next.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      await context.read<AuthProvider>().changePassword(
            currentPassword: current.text,
            password: next.text,
            passwordConfirmation: confirm.text,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<LanguageProvider>().t('success'))),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('changePassword'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: current, obscureText: true, decoration: InputDecoration(labelText: t('currentPassword'))),
          const SizedBox(height: 8),
          TextField(controller: next, obscureText: true, decoration: InputDecoration(labelText: t('newPassword'))),
          const SizedBox(height: 8),
          TextField(controller: confirm, obscureText: true, decoration: InputDecoration(labelText: t('confirmPassword'))),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : _save, child: Text(t('save'))),
        ],
      ),
    );
  }
}

class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});
  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  List<FaqItem> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final lang = context.read<LanguageProvider>().lang;
      final data = await context.read<AuthProvider>().api.get('/faqs');
      setState(() {
        items = parseList(data['faqs'] ?? data['data'] ?? data, (m) => FaqItem.fromJson(m, lang: lang));
      });
    } catch (_) {
      setState(() => items = []);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('faq'))),
      body: loading
          ? const LoadingView()
          : items.isEmpty
              ? EmptyState(message: t('empty'))
              : ListView(
                  children: items
                      .map((f) => ExpansionTile(title: Text(f.question), children: [
                            Padding(padding: const EdgeInsets.all(16), child: Text(f.answer)),
                          ]))
                      .toList(),
                ),
    );
  }
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final branding = context.watch<AppSettingsProvider>().branding;
    return Scaffold(
      appBar: AppBar(title: Text(t('about'))),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              BrandMark(size: 84),
              const SizedBox(height: 8),
              Text(branding.appName, style: Theme.of(context).textTheme.headlineSmall),
              Text(branding.appTagline, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              Text(t('aboutApp')),
              const SizedBox(height: 8),
              const Text('Version 1.0.0'),
            ],
          ),
        ),
      ),
    );
  }
}

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});
  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  List<FeedbackThread> items = [];
  bool loading = true;
  final subject = TextEditingController();
  final message = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/feedback');
      setState(() => items = parseList(data['feedback'] ?? data['data'] ?? data, FeedbackThread.fromJson));
    } catch (_) {
      setState(() => items = []);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _create() async {
    try {
      await context.read<AuthProvider>().api.post('/customer/feedback', body: {
        'subject': subject.text.trim(),
        'message': message.text.trim(),
      });
      subject.clear();
      message.clear();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('helpFeedback'))),
      body: loading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SectionHeader(title: t('newTicket')),
                TextField(controller: subject, decoration: InputDecoration(labelText: t('subject'))),
                const SizedBox(height: 8),
                TextField(controller: message, maxLines: 3, decoration: InputDecoration(labelText: t('message'))),
                const SizedBox(height: 8),
                FilledButton(onPressed: _create, child: Text(t('submit'))),
                const Divider(height: 32),
                ...items.map((f) => Card(
                      child: ListTile(
                        title: Text(f.subject),
                        subtitle: Text(f.status ?? ''),
                        onTap: () => context.push('/app/help/${f.id}'),
                      ),
                    )),
              ],
            ),
    );
  }
}

class HelpDetailScreen extends StatefulWidget {
  const HelpDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<HelpDetailScreen> createState() => _HelpDetailScreenState();
}

class _HelpDetailScreenState extends State<HelpDetailScreen> {
  FeedbackThread? thread;
  final reply = TextEditingController();
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/feedback/${widget.id}');
      setState(() => thread = FeedbackThread.fromJson(Map<String, dynamic>.from((data['feedback'] ?? data) as Map)));
    } catch (_) {
      setState(() => thread = null);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _send() async {
    try {
      await context.read<AuthProvider>().api.post('/customer/feedback/${widget.id}/replies', body: {
        'message': reply.text.trim(),
        'body': reply.text.trim(),
      });
      reply.clear();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('helpFeedback'))),
      body: loading
          ? const LoadingView()
          : thread == null
              ? EmptyState(message: t('empty'))
              : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          Text(thread!.subject, style: Theme.of(context).textTheme.titleLarge),
                          const SizedBox(height: 8),
                          Text(thread!.message ?? ''),
                          const Divider(),
                          ...thread!.replies.map((r) => ListTile(
                                title: Text(r.body),
                                subtitle: Text(r.isStaff ? 'Staff' : 'You'),
                              )),
                        ],
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(child: TextField(controller: reply, decoration: InputDecoration(labelText: t('reply')))),
                            IconButton(onPressed: _send, icon: const Icon(Icons.send)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
