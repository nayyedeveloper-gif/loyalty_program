import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/core/utils/formatters.dart';
import 'package:loyalty_mobile/models/membership.dart';
import 'package:loyalty_mobile/models/models.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/providers/notification_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final unread = context.watch<NotificationProvider>().totalUnread;
    final palette = AppPalette.of(context);
    return Scaffold(
      body: AppBackground(child: navigationShell),
      floatingActionButton: FloatingActionButton(
        heroTag: 'support-chat-fab',
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        onPressed: () => context.push('/app/inbox'),
        child: Badge(
          isLabelVisible: unread > 0,
          label: Text('$unread'),
          child: const Icon(Icons.chat_bubble_outline),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: palette.navBar,
          border: Border(top: BorderSide(color: palette.line.withValues(alpha: 0.9))),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: palette.isDark ? 0.35 : 0.05),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (i) {
            navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex);
            context.read<NotificationProvider>().refreshUnread();
          },
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.workspace_premium_outlined),
              selectedIcon: const Icon(Icons.workspace_premium),
              label: t('membership'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.casino_outlined),
              selectedIcon: const Icon(Icons.casino),
              label: t('spinwheel'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.receipt_long_outlined),
              selectedIcon: const Icon(Icons.receipt_long),
              label: t('purchase'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.card_giftcard_outlined),
              selectedIcon: const Icon(Icons.card_giftcard),
              label: t('rewards'),
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text('$unread'),
                child: const Icon(Icons.grid_view_rounded),
              ),
              selectedIcon: const Icon(Icons.grid_view_rounded),
              label: t('more'),
            ),
          ],
        ),
      ),
    );
  }
}

class MembershipScreen extends StatefulWidget {
  const MembershipScreen({super.key});
  @override
  State<MembershipScreen> createState() => _MembershipScreenState();
}

class _MembershipScreenState extends State<MembershipScreen> {
  Membership? membership;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().refreshUnread();
    });
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/membership');
      setState(() => membership = Membership.fromJson(Map<String, dynamic>.from(data['membership'] as Map)));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  int? _daysUntil(String? iso) {
    if (iso == null) return null;
    final dt = DateTime.tryParse(iso);
    if (dt == null) return null;
    return dt.difference(DateTime.now()).inDays.clamp(0, 99999);
  }

  String _greeting(LanguageProvider lang) {
    final hour = DateTime.now().hour;
    if (hour < 12) return lang.t('goodMorning');
    if (hour < 17) return lang.t('goodAfternoon');
    return lang.t('goodEvening');
  }

  double _tierProgress(Membership m) {
    final next = m.nextTier;
    if (next == null) return 1;
    if (next['progress'] is num) {
      return ((next['progress'] as num) / 100).clamp(0, 1).toDouble();
    }
    final rawMin = next['min_spend_mmk'] ?? next['min'] ?? 0;
    final min = rawMin is num ? rawMin.toDouble() : double.tryParse('$rawMin') ?? 0;
    if (min <= 0) return 0;
    return (m.totalSpent.toDouble() / min).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<LanguageProvider>();
    final t = lang.t;
    final locale = lang.lang;
    if (loading) {
      return Scaffold(body: LoadingView(label: t('loading')));
    }
    if (error != null || membership == null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: ErrorBanner(message: error ?? t('somethingWrong'), onRetry: _load),
          ),
        ),
      );
    }

    final m = membership!;
    final days = _daysUntil(m.pointsExpireAt);
    final next = m.nextTier;
    final progress = _tierProgress(m);
    final expiryLabel = formatDate(m.pointsExpireAt, locale: locale);
    final unread = context.watch<NotificationProvider>().totalUnread;
    final nextName = next == null ? '' : '${next['name'] ?? next['tier'] ?? ''}';

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            SafeArea(
              bottom: false,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_greeting(lang), style: Theme.of(context).textTheme.bodySmall),
                        Text(m.name, style: Theme.of(context).textTheme.headlineSmall),
                      ],
                    ),
                  ),
                  Material(
                    color: AppPalette.of(context).surface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: AppPalette.of(context).line),
                    ),
                    child: IconButton(
                      tooltip: t('notifications'),
                      onPressed: () => context.push('/app/notifications'),
                      icon: Badge(
                        isLabelVisible: unread > 0,
                        label: Text('$unread'),
                        child: const Icon(Icons.notifications_outlined),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(
                gradient: AppColors.gradientMembership,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.28),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${t(m.tier)}  ·  ${m.earnMultiplier}x',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${t('loginStreak')} ${m.loginStreak}',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(t('redeemablePoints'), style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12)),
                  Text(
                    formatPoints(m.redeemablePoints),
                    style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800, height: 1.05),
                  ),
                  if (days != null)
                    Text(
                      t('pointsExpiry', {'days': days, 'date': expiryLabel}),
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11),
                    ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                        child: QrImageView(
                          data: '29G:${m.customerCode}',
                          size: 88,
                          backgroundColor: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(t('customerId'), style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11)),
                            Text(
                              m.customerCode,
                              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 0.6),
                            ),
                            const SizedBox(height: 4),
                            Text(t('membershipCardHint'), style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: next == null
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t('diamondStatus'), style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 6),
                          Text(t('highestTier'), style: Theme.of(context).textTheme.bodySmall),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t('progressTo', {'tier': t(nextName.toLowerCase())}),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            t('earnMoreTierPoints', {
                              'points': formatMMK(next['remaining'] ?? 0),
                              'tier': nextName,
                            }),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: progress,
                              minHeight: 8,
                              backgroundColor: AppPalette.of(context).surface2,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            t('progressPercent', {'percent': (progress * 100).round()}),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _QuickTile(icon: Icons.casino_outlined, label: t('spinwheel'), onTap: () => context.go('/app/spinwheel'))),
                const SizedBox(width: 10),
                Expanded(child: _QuickTile(icon: Icons.card_giftcard_outlined, label: t('rewards'), onTap: () => context.go('/app/rewards'))),
                const SizedBox(width: 10),
                Expanded(child: _QuickTile(icon: Icons.group_add_outlined, label: t('invite'), onTap: () => context.push('/app/community'))),
              ],
            ),
            const SizedBox(height: 16),
            SectionHeader(title: t('quickActions')),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ActionLinkChip(icon: Icons.timeline, label: t('pointsActivity'), onPressed: () => context.push('/app/points')),
                _ActionLinkChip(icon: Icons.flag_outlined, label: t('missions'), onPressed: () => context.push('/app/missions')),
                _ActionLinkChip(icon: Icons.chat_bubble_outline, label: t('supportChat'), onPressed: () => context.push('/app/inbox')),
                _ActionLinkChip(icon: Icons.receipt_long_outlined, label: t('purchase'), onPressed: () => context.go('/app/history')),
              ],
            ),
            const SizedBox(height: 16),
            SectionHeader(title: t('tierBenefits')),
            Card(
              child: Column(
                children: (m.tiers?.entries.toList() ?? []).map((e) {
                  final cfg = e.value;
                  final perks = cfg is Map && cfg['perks'] is List ? (cfg['perks'] as List).join(' · ') : '';
                  final min = cfg is Map ? cfg['min_spend_mmk'] ?? cfg['min'] : 0;
                  final mult = cfg is Map ? cfg['multiplier'] : 1;
                  return ListTile(
                    title: Row(
                      children: [
                        TierPill(tier: t(e.key.toLowerCase())),
                        const Spacer(),
                        Text(
                          t('tierPerkLine', {'points': formatMMK(min is num ? min : 0), 'multiplier': mult}),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    subtitle: perks.isEmpty ? null : Text(perks),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t('howPointsWork'), style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Text('• ${t('howPointsWallet')}'),
                    Text('• ${t('howPointsTier')}'),
                    Text('• ${t('howPointsExpire')}'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionLinkChip extends StatelessWidget {
  const _ActionLinkChip({required this.icon, required this.label, required this.onPressed});
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return ActionChip(
      avatar: Icon(icon, size: 16, color: AppColors.primary),
      label: Text(label, style: TextStyle(color: palette.inkSoft, fontWeight: FontWeight.w700)),
      backgroundColor: palette.surface,
      side: BorderSide(color: palette.line),
      onPressed: onPressed,
    );
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return Material(
      color: palette.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: palette.line),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          height: 78,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: AppColors.primary),
              const SizedBox(height: 6),
              Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: palette.ink)),
            ],
          ),
        ),
      ),
    );
  }
}

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});
  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Purchase> items = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/purchases');
      setState(() => items = parseList(data['purchases'], Purchase.fromJson));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final lang = context.watch<LanguageProvider>().lang;
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('purchase'))),
      body: loading
          ? LoadingView(label: t('loading'))
          : error != null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
              : items.isEmpty
                  ? EmptyState(message: t('noPurchases'), icon: Icons.receipt_long_outlined)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final p = items[i];
                          return Card(
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              leading: Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: palette.primarySoft,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(Icons.shopping_bag_outlined, color: palette.onSoft),
                              ),
                              title: Text(
                                p.productName ?? p.productCode ?? '#${p.id}',
                                style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink),
                              ),
                              subtitle: Text(
                                '${formatDate(p.soldAt, locale: lang)}\n${formatMMK(p.netAmount ?? p.amount)}',
                                style: TextStyle(color: palette.inkSoft, height: 1.35),
                              ),
                              isThreeLine: true,
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('+${formatPoints(p.pointsEarned)}', style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w700)),
                                  Text(p.status ?? '', style: TextStyle(color: palette.inkSoft, fontSize: 12)),
                                ],
                              ),
                              onTap: () => context.push('/app/history/${p.id}'),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.id});
  final String id;
  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  Purchase? purchase;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthProvider>().api.get('/customer/purchases/${widget.id}');
      setState(() => purchase = Purchase.fromJson(Map<String, dynamic>.from(data['purchase'] as Map)));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final lang = context.watch<LanguageProvider>().lang;
    return Scaffold(
      appBar: AppBar(title: Text(t('receipt'))),
      body: loading
          ? const LoadingView()
          : error != null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(purchase!.productName ?? '—', style: Theme.of(context).textTheme.headlineSmall),
                            Text(purchase!.productCode ?? '', style: Theme.of(context).textTheme.bodySmall),
                            const Divider(height: 24),
                            _row(t('receipt'), purchase!.voucherNumber ?? '#${purchase!.id}'),
                            _row('Amount', formatMMK(purchase!.netAmount ?? purchase!.amount)),
                            _row(t('earn'), '${formatPoints(purchase!.pointsEarned)} ${t('points')}'),
                            _row(t('redeem'), '${formatPoints(purchase!.pointsRedeemed)} ${t('points')}'),
                            _row('Branch', purchase!.branchName ?? '—'),
                            _row('Date', formatDate(purchase!.soldAt, locale: lang)),
                            _row('Status', purchase!.status ?? '—'),
                          ],
                        ),
                      ),
                    ),
                    if (purchase!.productCode != null) ...[
                      const SizedBox(height: 12),
                      GradientButton(
                        label: t('writeReview'),
                        icon: Icons.rate_review_outlined,
                        onPressed: () => context.push(
                          '/app/reviews?product_code=${purchase!.productCode}&product_name=${Uri.encodeComponent(purchase!.productName ?? '')}',
                        ),
                      ),
                    ],
                  ],
                ),
    );
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(child: Text(k, style: const TextStyle(color: AppColors.inkSoft, fontWeight: FontWeight.w600))),
            Text(v, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
      );
}

class PointsScreen extends StatefulWidget {
  const PointsScreen({super.key});
  @override
  State<PointsScreen> createState() => _PointsScreenState();
}

class _PointsScreenState extends State<PointsScreen> {
  String filter = '';
  List<LedgerEntry> items = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AuthProvider>().api.get(
            '/customer/ledger',
            params: filter.isEmpty ? null : {'type': filter},
          );
      setState(() => items = parseList(data['ledger'], LedgerEntry.fromJson));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final lang = context.watch<LanguageProvider>().lang;
    final filters = {
      '': t('filterAll'),
      'earn': t('earn'),
      'redeem': t('redeem'),
      'bonus': t('bonus'),
      'expire': t('expire'),
      'adjustments': t('adjustments'),
    };
    return Scaffold(
      appBar: AppBar(title: Text(t('pointsActivity'))),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: filters.entries.map((e) {
                final selected = filter == e.key;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(e.value),
                    selected: selected,
                    onSelected: (_) {
                      setState(() => filter = e.key);
                      _load();
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: loading
                ? const LoadingView()
                : error != null
                    ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
                    : items.isEmpty
                        ? EmptyState(message: t('empty'), icon: Icons.timeline)
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: items.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, i) {
                              final e = items[i];
                              final positive = e.points >= 0;
                              return Card(
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: (positive ? AppColors.ok : AppColors.danger).withValues(alpha: 0.12),
                                    child: Icon(positive ? Icons.arrow_upward : Icons.arrow_downward,
                                        color: positive ? AppColors.ok : AppColors.danger, size: 18),
                                  ),
                                  title: Text(e.source ?? e.type, style: const TextStyle(fontWeight: FontWeight.w700)),
                                  subtitle: Text(formatDate(e.createdAt, locale: lang)),
                                  trailing: Text(
                                    '${positive ? '+' : ''}${formatPoints(e.points)}',
                                    style: TextStyle(fontWeight: FontWeight.w800, color: positive ? AppColors.ok : AppColors.danger),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final notif = context.watch<NotificationProvider>();
    final user = context.watch<AuthProvider>().user;
    return Scaffold(
      appBar: AppBar(title: Text(t('more'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.all(14),
              leading: CircleAvatar(
                radius: 26,
                backgroundColor: AppPalette.of(context).primarySoft,
                child: Text(
                  (user?.name.isNotEmpty == true ? user!.name[0] : 'M').toUpperCase(),
                  style: TextStyle(color: AppPalette.of(context).onSoft, fontWeight: FontWeight.w800, fontSize: 18),
                ),
              ),
              title: Text(user?.name ?? '', style: TextStyle(fontWeight: FontWeight.w700, color: AppPalette.of(context).ink)),
              subtitle: Text(
                '${t(user?.tier ?? 'care')}  ·  ${user?.customerCode ?? ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              trailing: Icon(Icons.chevron_right, color: AppPalette.of(context).muted),
              onTap: () => context.push('/app/settings/profile'),
            ),
          ),
          const SizedBox(height: 14),
          SettingsTile(icon: Icons.timeline, title: t('pointsActivity'), onTap: () => context.push('/app/points')),
          SettingsTile(icon: Icons.flag_outlined, title: t('missions'), onTap: () => context.push('/app/missions')),
          SettingsTile(icon: Icons.groups_outlined, title: t('communityHub'), subtitle: t('shareReferral'), onTap: () => context.push('/app/community')),
          SettingsTile(icon: Icons.rate_review_outlined, title: t('reviews'), onTap: () => context.push('/app/reviews')),
          SettingsTile(
            icon: Icons.chat_bubble_outline,
            title: t('supportChat'),
            subtitle: t('supportChatHint'),
            trailing: notif.chatUnread > 0
                ? Badge(label: Text('${notif.chatUnread}'))
                : Icon(Icons.chevron_right, color: AppPalette.of(context).muted),
            onTap: () => context.push('/app/inbox'),
          ),
          SettingsTile(
            icon: Icons.notifications_outlined,
            title: t('notifications'),
            trailing: notif.unread > 0
                ? Badge(label: Text('${notif.unread}'))
                : Icon(Icons.chevron_right, color: AppPalette.of(context).muted),
            onTap: () => context.push('/app/notifications'),
          ),
          SettingsTile(icon: Icons.settings_outlined, title: t('settings'), onTap: () => context.push('/app/settings')),
          SettingsTile(icon: Icons.help_outline, title: t('helpFeedback'), onTap: () => context.push('/app/help')),
          SettingsTile(
            icon: Icons.logout,
            title: t('signOut'),
            danger: true,
            onTap: () async {
              final ok = await showConfirmDialog(
                context,
                title: t('signOut'),
                message: t('logoutConfirm'),
                confirmLabel: t('signOut'),
                cancelLabel: t('cancel'),
              );
              if (!ok || !context.mounted) return;
              await context.read<AuthProvider>().logout();
              if (context.mounted) context.go('/landing');
            },
          ),
        ],
      ),
    );
  }
}
