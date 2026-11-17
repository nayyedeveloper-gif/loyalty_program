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
    final unread = context.watch<NotificationProvider>().unread;
    return Scaffold(
      body: AppBackground(child: navigationShell),
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (i) {
          navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex);
          context.read<NotificationProvider>().refreshUnread();
        },
        destinations: [
          NavigationDestination(icon: const Icon(Icons.workspace_premium_outlined), selectedIcon: const Icon(Icons.workspace_premium), label: t('membership')),
          NavigationDestination(icon: const Icon(Icons.casino_outlined), selectedIcon: const Icon(Icons.casino), label: t('spinwheel')),
          NavigationDestination(icon: const Icon(Icons.receipt_long_outlined), selectedIcon: const Icon(Icons.receipt_long), label: t('purchaseHistory')),
          NavigationDestination(icon: const Icon(Icons.card_giftcard_outlined), selectedIcon: const Icon(Icons.card_giftcard), label: t('rewards')),
          NavigationDestination(
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.grid_view_rounded)),
            selectedIcon: const Icon(Icons.grid_view_rounded),
            label: t('more'),
          ),
        ],
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

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final lang = context.watch<LanguageProvider>().lang;
    if (loading) {
      return Scaffold(appBar: AppBar(title: Text(t('myMembership'))), body: LoadingView(label: t('loading')));
    }
    if (error != null || membership == null) {
      return Scaffold(
        appBar: AppBar(title: Text(t('myMembership'))),
        body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error ?? t('somethingWrong'), onRetry: _load)),
      );
    }

    final m = membership!;
    final days = _daysUntil(m.pointsExpireAt);
    final next = m.nextTier;
    final progress = next == null
        ? 0.0
        : ((next['progress'] is num)
            ? (next['progress'] as num).toDouble()
            : double.tryParse('${next['progress']}') ?? 0);
    final expiryLabel = formatDate(m.pointsExpireAt, locale: lang);
    final divisor = m.settings?['base_earn_divisor'] ?? 10000;

    return Scaffold(
      appBar: AppBar(
        title: Text(t('myMembership')),
        actions: [
          IconButton(
            tooltip: t('notifications'),
            onPressed: () => context.push('/app/notifications'),
            icon: Badge(
              isLabelVisible: context.watch<NotificationProvider>().unread > 0,
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            SectionHeader(title: t('myMembership'), subtitle: t('membershipSubtitle')),
            Card(
              clipBehavior: Clip.antiAlias,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.08),
                      Colors.white,
                    ],
                  ),
                ),
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: QrImageView(
                        data: '29G:${m.customerCode}',
                        size: 112,
                        backgroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t('membershipCard'), style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text(m.customerCode, style: Theme.of(context).textTheme.headlineSmall?.copyWith(letterSpacing: 1)),
                          Text(m.name, style: Theme.of(context).textTheme.bodyMedium),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              TierPill(tier: t(m.tier)),
                              Text('${formatPoints(m.redeemablePoints)} ${t('points')}',
                                  style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primaryDark)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(t('membershipCardHint'), style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (days != null && days <= 45 && m.redeemablePoints > 0) ...[
              const SizedBox(height: 12),
              days <= 7
                  ? ErrorBanner(message: t('pointsExpiry', {'days': days, 'date': expiryLabel}))
                  : SuccessBanner(message: t('pointsExpiry', {'days': days, 'date': expiryLabel})),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    label: t('customerId'),
                    value: m.customerCode,
                    hint: '${t('referralCode')}: ${m.referralCode ?? '—'}',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: StatCard(
                    label: t('currentTier'),
                    value: t(m.tier),
                    hint: t('earnMultiplierLabel', {'multiplier': m.earnMultiplier}),
                    child: m.currentPerks.isEmpty
                        ? null
                        : Text(m.currentPerks.take(2).join(' · '), style: Theme.of(context).textTheme.bodySmall),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: StatCard(
                    icon: Icons.diamond_outlined,
                    label: t('redeemablePoints'),
                    value: formatPoints(m.redeemablePoints),
                    hint: t('pointsExpireHint', {'date': expiryLabel}),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: StatCard(
                    icon: Icons.emoji_events_outlined,
                    label: t('tierPoints365'),
                    value: formatPoints(m.tierPoints365d),
                    hint: t('tierPointsHint'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: StatCard(label: t('totalSpent'), value: formatMMK(m.totalSpent))),
                const SizedBox(width: 10),
                Expanded(child: StatCard(label: t('loginStreak'), value: '${m.loginStreak}')),
              ],
            ),
            const SizedBox(height: 10),
            StatCard(
              label: t('earnRule'),
              value: t('earnRuleCopy', {'divisor': divisor}),
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
                            t('progressTo', {'tier': t('${next['name'] ?? next['tier'] ?? ''}'.toLowerCase())}),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            t('earnMoreTierPoints', {
                              'points': formatPoints(next['remaining'] ?? 0),
                              'tier': '${next['name'] ?? next['tier'] ?? ''}',
                            }),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if ((next['estimated_spend_mmk'] is num) && (next['estimated_spend_mmk'] as num) > 0) ...[
                            const SizedBox(height: 6),
                            Text(
                              t('tierSpendCoach', {
                                'amount': formatMMK(next['estimated_spend_mmk']),
                                'tier': '${next['name'] ?? ''}',
                                'multiplier': next['at_multiplier'] ?? m.earnMultiplier,
                              }),
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                          ],
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: (progress / 100).clamp(0, 1),
                              minHeight: 10,
                              backgroundColor: AppColors.primarySoft,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(t('progressPercent', {'percent': progress.round()}), style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
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
            const SizedBox(height: 12),
            SectionHeader(title: t('quickActions')),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(avatar: const Icon(Icons.card_giftcard, size: 16), label: Text(t('rewardsCatalog')), onPressed: () => context.go('/app/rewards')),
                ActionChip(avatar: const Icon(Icons.flag, size: 16), label: Text(t('missions')), onPressed: () => context.push('/app/missions')),
                ActionChip(avatar: const Icon(Icons.timeline, size: 16), label: Text(t('pointsActivity')), onPressed: () => context.push('/app/points')),
                ActionChip(avatar: const Icon(Icons.casino, size: 16), label: Text(t('spinwheel')), onPressed: () => context.go('/app/spinwheel')),
              ],
            ),
            const SizedBox(height: 16),
            SectionHeader(title: t('tierBenefits')),
            Card(
              child: Column(
                children: (m.tiers?.entries.toList() ?? []).map((e) {
                  final cfg = e.value;
                  final perks = cfg is Map && cfg['perks'] is List ? (cfg['perks'] as List).join(' · ') : '';
                  final min = cfg is Map ? cfg['min'] : 0;
                  final mult = cfg is Map ? cfg['multiplier'] : 1;
                  return ListTile(
                    title: Row(
                      children: [
                        TierPill(tier: t(e.key.toLowerCase())),
                        const Spacer(),
                        Text(
                          t('tierPerkLine', {'points': formatPoints(min is num ? min : 0), 'multiplier': mult}),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    subtitle: perks.isEmpty ? null : Text(perks),
                  );
                }).toList(),
              ),
            ),
          ],
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
    return Scaffold(
      appBar: AppBar(title: Text(t('purchaseHistory'))),
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
                                  color: AppColors.primarySoft,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.shopping_bag_outlined, color: AppColors.primaryDark),
                              ),
                              title: Text(p.productName ?? p.productCode ?? '#${p.id}', style: const TextStyle(fontWeight: FontWeight.w700)),
                              subtitle: Text('${formatDate(p.soldAt, locale: lang)}\n${formatMMK(p.netAmount ?? p.amount)}'),
                              isThreeLine: true,
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('+${formatPoints(p.pointsEarned)}', style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w700)),
                                  Text(p.status ?? '', style: Theme.of(context).textTheme.bodySmall),
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
            Expanded(child: Text(k, style: const TextStyle(color: AppColors.muted))),
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
    final unread = context.watch<NotificationProvider>().unread;
    final user = context.watch<AuthProvider>().user;
    return Scaffold(
      appBar: AppBar(title: Text(t('more'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.primarySoft,
                child: Text((user?.name.isNotEmpty == true ? user!.name[0] : 'M').toUpperCase(),
                    style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800)),
              ),
              title: Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(user?.email ?? ''),
              trailing: TierPill(tier: t(user?.tier ?? 'care')),
            ),
          ),
          const SizedBox(height: 14),
          SettingsTile(icon: Icons.timeline, title: t('pointsActivity'), onTap: () => context.push('/app/points')),
          SettingsTile(icon: Icons.flag_outlined, title: t('missions'), onTap: () => context.push('/app/missions')),
          SettingsTile(icon: Icons.groups_outlined, title: t('communityHub'), subtitle: t('shareReferral'), onTap: () => context.push('/app/community')),
          SettingsTile(icon: Icons.rate_review_outlined, title: t('reviews'), onTap: () => context.push('/app/reviews')),
          SettingsTile(
            icon: Icons.notifications_outlined,
            title: t('notifications'),
            trailing: unread > 0 ? Badge(label: Text('$unread')) : const Icon(Icons.chevron_right, color: AppColors.muted),
            onTap: () => context.push('/app/notifications'),
          ),
          SettingsTile(icon: Icons.settings_outlined, title: t('settings'), onTap: () => context.push('/app/settings')),
          SettingsTile(icon: Icons.help_outline, title: t('helpFeedback'), onTap: () => context.push('/app/help')),
          SettingsTile(
            icon: Icons.logout,
            title: t('signOut'),
            danger: true,
            onTap: () async {
              final ok = await showConfirmDialog(context, title: t('signOut'), message: t('logoutConfirm'), confirmLabel: t('signOut'), cancelLabel: t('cancel'));
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
