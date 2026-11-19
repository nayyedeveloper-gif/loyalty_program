import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:loyalty_mobile/core/config/app_config.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/core/utils/formatters.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

String _guestPublicUrl(Map<String, dynamic> data) {
  final url = data['url']?.toString();
  if (url != null && url.isNotEmpty) return url;
  final path = data['path']?.toString();
  if (path != null && path.isNotEmpty) {
    return path.startsWith('http') ? path : '${AppConfig.mediaOrigin}$path';
  }
  final token = data['access_token']?.toString();
  if (token != null && token.isNotEmpty) {
    return '${AppConfig.mediaOrigin}/guest/$token';
  }
  return '';
}

class AdminSpinHubScreen extends StatefulWidget {
  const AdminSpinHubScreen({super.key});

  @override
  State<AdminSpinHubScreen> createState() => _AdminSpinHubScreenState();
}

class _AdminSpinHubScreenState extends State<AdminSpinHubScreen> {
  bool loading = true;
  String? error;
  Map<String, int> stats = {};
  List<Map<String, dynamic>> recent = [];

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
      final api = context.read<AuthProvider>().api;
      final results = await Future.wait([
        api.spinAdminUsages(),
        api.spinAdminRewards(),
        api.spinAdminGuestSpins(),
        api.spinAdminWheels(),
      ]);
      final usages = results[0];
      final rewards = results[1];
      final guests = results[2];
      final wheels = results[3];
      if (!mounted) return;
      setState(() {
        stats = {
          'wheels': wheels.length,
          'totalUsages': usages.length,
          'available': usages.where((u) => u['status'] == 'available').length,
          'used': usages.where((u) => u['status'] == 'used').length,
          'rewards': rewards.length,
          'awaiting': rewards.where((r) => r['display_status'] == 'ready_to_collect').length,
          'claimed': rewards.where((r) => r['display_status'] == 'claimed').length,
          'expired': rewards.where((r) => r['display_status'] == 'expired').length,
          'guests': guests
              .where((g) => g['status'] == 'available' || g['status'] == 'reserved')
              .length,
        };
        recent = rewards.take(8).toList();
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = getErrorMessage(e);
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    return Scaffold(
      backgroundColor: palette.background,
      appBar: AppBar(title: Text(t('adminSpinWheel'))),
      body: loading
          ? LoadingView(label: t('loading'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (error != null) ErrorBanner(message: error!, onRetry: _load),
                  Text(
                    t('adminSpinWheelSubtitle'),
                    style: TextStyle(color: palette.muted, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.35,
                    children: [
                      StatCard(label: t('wheels'), value: '${stats['wheels'] ?? 0}', icon: Icons.donut_large),
                      StatCard(label: t('spinRecords'), value: '${stats['totalUsages'] ?? 0}', icon: Icons.history),
                      StatCard(label: t('availableSpins'), value: '${stats['available'] ?? 0}', icon: Icons.bolt_outlined),
                      StatCard(label: t('rewardsIssued'), value: '${stats['rewards'] ?? 0}', icon: Icons.card_giftcard_outlined),
                      StatCard(label: t('awaitingCollection'), value: '${stats['awaiting'] ?? 0}', icon: Icons.storefront_outlined),
                      StatCard(
                        label: t('claimedExpired'),
                        value: '${stats['claimed'] ?? 0} / ${stats['expired'] ?? 0}',
                        icon: Icons.check_circle_outline,
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  SectionHeader(title: t('manage')),
                  SettingsTile(
                    icon: Icons.donut_large,
                    title: t('wheelAndPrizes'),
                    subtitle: t('wheelAndPrizesHint'),
                    onTap: () => context.push('/admin/spinwheel/wheels'),
                  ),
                  SettingsTile(
                    icon: Icons.person_add_alt_1_outlined,
                    title: t('customerSpins'),
                    subtitle: t('customerSpinsHint'),
                    onTap: () => context.push('/admin/spinwheel/usage'),
                  ),
                  SettingsTile(
                    icon: Icons.link_outlined,
                    title: t('guestSpins'),
                    subtitle: t('guestSpinsHint'),
                    onTap: () => context.push('/admin/spinwheel/guests'),
                  ),
                  SettingsTile(
                    icon: Icons.verified_outlined,
                    title: t('rewardVerification'),
                    subtitle: t('rewardVerificationHint'),
                    onTap: () => context.push('/admin/spinwheel/rewards'),
                  ),
                  if (recent.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    SectionHeader(title: t('recentRewards')),
                    ...recent.map((r) {
                      return Card(
                        child: ListTile(
                          title: Text(
                            '${r['reward_code'] ?? '—'} · ${r['prize_label'] ?? t('reward')}',
                            style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink),
                          ),
                          subtitle: Text(
                            '${r['status_label'] ?? r['display_status'] ?? ''} · ${formatDate(r['created_at']?.toString())}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push('/admin/spinwheel/rewards'),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }
}

class AdminSpinWheelsScreen extends StatefulWidget {
  const AdminSpinWheelsScreen({super.key});

  @override
  State<AdminSpinWheelsScreen> createState() => _AdminSpinWheelsScreenState();
}

class _AdminSpinWheelsScreenState extends State<AdminSpinWheelsScreen> {
  bool loading = true;
  String? error;
  List<Map<String, dynamic>> wheels = [];

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
      final rows = await context.read<AuthProvider>().api.spinAdminWheels();
      if (!mounted) return;
      setState(() {
        wheels = rows;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = getErrorMessage(e);
        loading = false;
      });
    }
  }

  Future<void> _open(Map<String, dynamic> wheel) async {
    final id = wheel['id'];
    if (id == null) return;
    try {
      final detail = await context.read<AuthProvider>().api.spinAdminWheel(id);
      if (!mounted) return;
      final segments = (detail['segments'] is List)
          ? (detail['segments'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
          : <Map<String, dynamic>>[];
      final t = context.read<LanguageProvider>().t;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail['title']?.toString() ?? t('wheel'),
                    style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${t('status')}: ${detail['status'] ?? '—'} · ${t('segments')}: ${segments.length}',
                    style: TextStyle(color: AppPalette.of(ctx).muted),
                  ),
                  const SizedBox(height: 12),
                  ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.45),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: segments.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final s = segments[i];
                        final label = '${s['display_label'] ?? s['prize_label'] ?? s['label'] ?? '—'}';
                        final imageSrc = AppConfig.mediaUrl(
                          s['image_url']?.toString() ??
                              (s['image_path'] != null ? '/storage/${s['image_path']}' : null),
                        );
                        return ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: SizedBox(
                              width: 40,
                              height: 40,
                              child: imageSrc.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: imageSrc,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) => ColoredBox(
                                        color: AppPalette.of(ctx).mist,
                                        child: Center(
                                          child: Text(
                                            label.isNotEmpty ? label[0].toUpperCase() : '?',
                                            style: const TextStyle(fontWeight: FontWeight.w800),
                                          ),
                                        ),
                                      ),
                                    )
                                  : ColoredBox(
                                      color: AppPalette.of(ctx).mist,
                                      child: Center(
                                        child: Text(
                                          label.isNotEmpty ? label[0].toUpperCase() : '?',
                                          style: const TextStyle(fontWeight: FontWeight.w800),
                                        ),
                                      ),
                                    ),
                            ),
                          ),
                          title: Text(label),
                          subtitle: Text('${t('weight')}: ${s['weight'] ?? 0} · ${s['tier'] ?? ''}'),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      backgroundColor: AppPalette.of(context).background,
      appBar: AppBar(title: Text(t('wheelAndPrizes'))),
      body: loading
          ? LoadingView(label: t('loading'))
          : error != null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: ErrorBanner(message: error!, onRetry: _load),
                )
              : wheels.isEmpty
                  ? EmptyState(message: t('noWheels'), icon: Icons.donut_large)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: wheels.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final w = wheels[i];
                          final published = w['status'] == 'published' || w['is_published'] == true;
                          return Card(
                            child: ListTile(
                              title: Text(
                                w['title']?.toString() ?? t('wheel'),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppPalette.of(context).ink,
                                ),
                              ),
                              subtitle: Text('${t('status')}: ${w['status'] ?? (published ? 'published' : 'draft')}'),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => _open(w),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

class AdminSpinUsageScreen extends StatefulWidget {
  const AdminSpinUsageScreen({super.key});

  @override
  State<AdminSpinUsageScreen> createState() => _AdminSpinUsageScreenState();
}

class _AdminSpinUsageScreenState extends State<AdminSpinUsageScreen> {
  bool loading = true;
  bool busy = false;
  String? error;
  String search = '';
  List<Map<String, dynamic>> customers = [];
  String? customerId;
  List<Map<String, dynamic>> usages = [];
  final countCtrl = TextEditingController(text: '1');
  final hoursCtrl = TextEditingController(text: '24');
  final grantOnRegCtrl = TextEditingController(text: '0');
  int defaultValidHours = 24;
  final regMessageCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    countCtrl.dispose();
    hoursCtrl.dispose();
    grantOnRegCtrl.dispose();
    regMessageCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final api = context.read<AuthProvider>().api;
      final custRes = await api.get('/admin/customers', params: {'per_page': 200});
      final list = ((custRes['customers'] is Map ? custRes['customers']['data'] : null) as List? ??
              custRes['data'] as List? ??
              const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((u) {
            final email = '${u['email'] ?? ''}'.toLowerCase();
            final name = '${u['name'] ?? ''}'.toLowerCase();
            return email != 'guest-pool@spinwheel.local' && !name.contains('guest spin pool');
          })
          .toList();
      final settings = await api.spinAdminSettings();
      final usageRows = await api.spinAdminUsages();
      if (!mounted) return;
      setState(() {
        customers = list;
        usages = usageRows;
        grantOnRegCtrl.text = '${settings['grant_on_registration'] ?? 0}';
        defaultValidHours = int.tryParse('${settings['default_valid_hours'] ?? 24}') ?? 24;
        regMessageCtrl.text = settings['registration_grant_message']?.toString() ?? '';
        hoursCtrl.text = '$defaultValidHours';
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = getErrorMessage(e);
        loading = false;
      });
    }
  }

  Future<void> _loadUsages([String? id]) async {
    try {
      final rows = await context.read<AuthProvider>().api.spinAdminUsages(userId: id);
      if (!mounted) return;
      setState(() => usages = rows);
    } catch (e) {
      if (!mounted) return;
      setState(() => error = getErrorMessage(e));
    }
  }

  List<Map<String, dynamic>> get filteredCustomers {
    final q = search.trim().toLowerCase();
    if (q.isEmpty) return customers;
    return customers.where((u) {
      final hay = [
        u['name'],
        u['email'],
        u['phone'],
        u['customer_code'],
        u['id'],
      ].where((v) => v != null).join(' ').toLowerCase();
      return hay.contains(q);
    }).toList();
  }

  Future<void> _grant() async {
    final id = customerId;
    if (id == null) return;
    final t = context.read<LanguageProvider>().t;
    final ok = await showConfirmDialog(
      context,
      title: t('grantSpins'),
      message: t('grantSpinsConfirm'),
      confirmLabel: t('confirm'),
      cancelLabel: t('cancel'),
    );
    if (!ok || !mounted) return;
    setState(() => busy = true);
    try {
      await context.read<AuthProvider>().api.spinAdminGrantUsages(
            userId: id,
            count: int.tryParse(countCtrl.text.trim()) ?? 1,
            validHours: int.tryParse(hoursCtrl.text.trim()) ?? 24,
          );
      await _loadUsages(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('spinsGranted'))));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _revoke(Map<String, dynamic> usage) async {
    final t = context.read<LanguageProvider>().t;
    final ok = await showConfirmDialog(
      context,
      title: t('revokeSpin'),
      message: t('revokeSpinConfirm'),
      confirmLabel: t('confirm'),
      cancelLabel: t('cancel'),
    );
    if (!ok || !mounted) return;
    setState(() => busy = true);
    try {
      await context.read<AuthProvider>().api.spinAdminAdjustUsage(usage['id'], status: 'revoked');
      await _loadUsages(customerId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('spinRevoked'))));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _saveSettings() async {
    setState(() => busy = true);
    try {
      await context.read<AuthProvider>().api.spinAdminUpdateSettings({
        'grant_on_registration': int.tryParse(grantOnRegCtrl.text.trim()) ?? 0,
        'registration_grant_message': regMessageCtrl.text.trim(),
        'default_valid_hours': int.tryParse(hoursCtrl.text.trim()) ?? defaultValidHours,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<LanguageProvider>().t('settingsSaved'))),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    final available = usages.where((u) => u['status'] == 'available').length;
    return Scaffold(
      backgroundColor: palette.background,
      appBar: AppBar(title: Text(t('customerSpins'))),
      body: loading
          ? LoadingView(label: t('loading'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (error != null) ErrorBanner(message: error!, onRetry: _bootstrap),
                TextField(
                  decoration: InputDecoration(
                    labelText: t('searchCustomers'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (v) => setState(() => search = v),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: customerId ?? '',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: t('member')),
                  items: [
                    DropdownMenuItem(value: '', child: Text(t('allMembers'))),
                    ...filteredCustomers.map((c) {
                      final id = '${c['id']}';
                      final label = '${c['name'] ?? '—'} (${c['customer_code'] ?? id})';
                      return DropdownMenuItem(value: id, child: Text(label, overflow: TextOverflow.ellipsis));
                    }),
                  ],
                  onChanged: (v) {
                    final next = (v == null || v.isEmpty) ? null : v;
                    setState(() => customerId = next);
                    _loadUsages(next);
                  },
                ),
                const SizedBox(height: 14),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('grantSpins'), style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: countCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: t('spinCount')),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: hoursCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: t('validHours')),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        FilledButton(
                          onPressed: busy || customerId == null ? null : _grant,
                          child: Text(t('grantSpins')),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t('registrationSpins'), style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        TextField(
                          controller: grantOnRegCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(labelText: t('grantOnRegistration')),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: regMessageCtrl,
                          maxLines: 3,
                          decoration: InputDecoration(labelText: t('registrationGrantMessage')),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton(
                          onPressed: busy ? null : _saveSettings,
                          child: Text(t('saveSettings')),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SectionHeader(
                  title: t('spinRecords'),
                  subtitle: t('availableSpinsCount', {'count': available}),
                ),
                if (usages.isEmpty)
                  EmptyState(message: t('noSpinRecords'), icon: Icons.history)
                else
                  ...usages.map((u) {
                    final status = '${u['status'] ?? ''}';
                    return Card(
                      child: ListTile(
                        title: Text(
                          '${u['user'] is Map ? (u['user']['name'] ?? '—') : (u['user_id'] ?? '—')}',
                          style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink),
                        ),
                        subtitle: Text(
                          '$status · ${formatDate(u['expires_at']?.toString() ?? u['created_at']?.toString())}',
                        ),
                        trailing: status == 'available'
                            ? TextButton(
                                onPressed: busy ? null : () => _revoke(u),
                                child: Text(t('revoke')),
                              )
                            : null,
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}

class AdminSpinRewardsScreen extends StatefulWidget {
  const AdminSpinRewardsScreen({super.key});

  @override
  State<AdminSpinRewardsScreen> createState() => _AdminSpinRewardsScreenState();
}

class _AdminSpinRewardsScreenState extends State<AdminSpinRewardsScreen> {
  bool loading = true;
  bool busy = false;
  String? error;
  final qCtrl = TextEditingController();
  String audience = 'all';
  String status = '';
  List<Map<String, dynamic>> results = [];

  @override
  void initState() {
    super.initState();
    _search();
  }

  @override
  void dispose() {
    qCtrl.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final rows = await context.read<AuthProvider>().api.spinAdminRewards(
            q: qCtrl.text.trim(),
            audience: audience,
            status: status.isEmpty ? null : status,
          );
      if (!mounted) return;
      setState(() {
        results = rows;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = getErrorMessage(e);
        loading = false;
      });
    }
  }

  Future<void> _open(Map<String, dynamic> reward) async {
    setState(() => busy = true);
    try {
      final selected = await context.read<AuthProvider>().api.spinAdminReward(reward['id']);
      if (!mounted) return;
      final t = context.read<LanguageProvider>().t;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) {
          final display = selected['display_status']?.toString() ?? '';
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t('verifyReward'), style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  Text('${t('reference')}: ${selected['reward_code'] ?? '—'}'),
                  Text('${t('prize')}: ${selected['prize_label'] ?? '—'}'),
                  Text('${t('status')}: ${selected['status_label'] ?? display}'),
                  Text('${t('deadline')}: ${formatDate(selected['claim_deadline_at']?.toString())}'),
                  if (selected['instructions'] != null) ...[
                    const SizedBox(height: 8),
                    Text('${selected['instructions']}'),
                  ],
                  const SizedBox(height: 14),
                  if (display == 'ready_to_collect')
                    FilledButton(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await _claim(selected, overrideExpired: false);
                      },
                      child: Text(t('markCollected')),
                    ),
                  if (display == 'expired')
                    OutlinedButton(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await _claim(selected, overrideExpired: true);
                      },
                      child: Text(t('claimOverrideExpired')),
                    ),
                ],
              ),
            ),
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _claim(Map<String, dynamic> selected, {required bool overrideExpired}) async {
    final t = context.read<LanguageProvider>().t;
    final ok = await showConfirmDialog(
      context,
      title: t('markCollected'),
      message: overrideExpired ? t('claimOverrideConfirm') : t('claimConfirm'),
      confirmLabel: t('confirm'),
      cancelLabel: t('cancel'),
    );
    if (!ok || !mounted) return;
    setState(() => busy = true);
    try {
      await context.read<AuthProvider>().api.spinAdminClaimReward(
            selected['id'],
            overrideExpired: overrideExpired,
          );
      await _search();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('rewardClaimed'))));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    return Scaffold(
      backgroundColor: palette.background,
      appBar: AppBar(title: Text(t('rewardVerification'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                TextField(
                  controller: qCtrl,
                  decoration: InputDecoration(
                    labelText: t('searchRewards'),
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onSubmitted: (_) => _search(),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: audience,
                        decoration: InputDecoration(labelText: t('audience')),
                        items: [
                          DropdownMenuItem(value: 'all', child: Text(t('allAudiences'))),
                          DropdownMenuItem(value: 'customer', child: Text(t('registeredCustomers'))),
                          DropdownMenuItem(value: 'guest', child: Text(t('guestRewards'))),
                        ],
                        onChanged: (v) => setState(() => audience = v ?? 'all'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: status,
                        decoration: InputDecoration(labelText: t('status')),
                        items: [
                          DropdownMenuItem(value: '', child: Text(t('allStatuses'))),
                          DropdownMenuItem(value: 'ready_to_collect', child: Text(t('readyToCollect'))),
                          DropdownMenuItem(value: 'claimed', child: Text(t('claimed'))),
                          DropdownMenuItem(value: 'expired', child: Text(t('expired'))),
                        ],
                        onChanged: (v) => setState(() => status = v ?? ''),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton(onPressed: busy ? null : _search, child: Text(t('search'))),
                ),
              ],
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ErrorBanner(message: error!, onRetry: _search),
            ),
          Expanded(
            child: loading
                ? LoadingView(label: t('loading'))
                : results.isEmpty
                    ? EmptyState(message: t('noRewardsFound'), icon: Icons.card_giftcard_outlined)
                    : RefreshIndicator(
                        onRefresh: _search,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: results.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final r = results[i];
                            final isGuest = r['is_guest'] == true;
                            final who = isGuest
                                ? (r['guest_reference']?.toString() ?? t('guestSpin'))
                                : (r['user'] is Map
                                    ? '${r['user']['name'] ?? '—'}${r['user']['customer_code'] != null ? ' (${r['user']['customer_code']})' : ''}'
                                    : t('member'));
                            return Card(
                              child: ListTile(
                                title: Text(
                                  '${r['reward_code'] ?? '—'} · ${r['prize_label'] ?? ''}',
                                  style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink),
                                ),
                                subtitle: Text(
                                  '$who · ${r['status_label'] ?? r['display_status'] ?? ''} · ${formatDate(r['created_at']?.toString())}',
                                ),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: busy ? null : () => _open(r),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class AdminGuestSpinsScreen extends StatefulWidget {
  const AdminGuestSpinsScreen({super.key});

  @override
  State<AdminGuestSpinsScreen> createState() => _AdminGuestSpinsScreenState();
}

class _AdminGuestSpinsScreenState extends State<AdminGuestSpinsScreen> {
  bool loading = true;
  bool busy = false;
  String? error;
  String status = '';
  final qCtrl = TextEditingController();
  final hoursCtrl = TextEditingController(text: '72');
  List<Map<String, dynamic>> rows = [];
  String? createdUrl;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    qCtrl.dispose();
    hoursCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final list = await context.read<AuthProvider>().api.spinAdminGuestSpins(
            q: qCtrl.text.trim(),
            status: status.isEmpty ? null : status,
          );
      if (!mounted) return;
      setState(() {
        rows = list;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = getErrorMessage(e);
        loading = false;
      });
    }
  }

  Future<void> _generate() async {
    setState(() => busy = true);
    try {
      final data = await context.read<AuthProvider>().api.spinAdminCreateGuestSpin(
            validHours: int.tryParse(hoursCtrl.text.trim()),
          );
      final url = _guestPublicUrl(data);
      if (!mounted) return;
      setState(() => createdUrl = url);
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<LanguageProvider>().t('guestLinkCreated'))),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _copy(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.read<LanguageProvider>().t('linkCopied'))),
    );
  }

  Future<void> _revoke(Map<String, dynamic> row) async {
    final t = context.read<LanguageProvider>().t;
    final ok = await showConfirmDialog(
      context,
      title: t('revokeGuestLink'),
      message: t('revokeGuestLinkConfirm'),
      confirmLabel: t('confirm'),
      cancelLabel: t('cancel'),
    );
    if (!ok || !mounted) return;
    setState(() => busy = true);
    try {
      await context.read<AuthProvider>().api.spinAdminRevokeGuestSpin(row['id']);
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('guestLinkRevoked'))));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    return Scaffold(
      backgroundColor: palette.background,
      appBar: AppBar(title: Text(t('guestSpins'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null) ErrorBanner(message: error!, onRetry: _load),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t('generateGuestLink'), style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(t('generateGuestLinkHint'), style: TextStyle(color: palette.muted, height: 1.35)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: hoursCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: t('validHours')),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: busy ? null : _generate,
                    child: Text(t('generateGuestLink')),
                  ),
                  if (createdUrl != null && createdUrl!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    SelectableText(createdUrl!, style: const TextStyle(fontWeight: FontWeight.w600)),
                    TextButton.icon(
                      onPressed: () => _copy(createdUrl!),
                      icon: const Icon(Icons.copy),
                      label: Text(t('copyLink')),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: qCtrl,
            decoration: InputDecoration(
              labelText: t('searchGuestLinks'),
              prefixIcon: const Icon(Icons.search),
            ),
            onSubmitted: (_) => _load(),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: status,
            decoration: InputDecoration(labelText: t('status')),
            items: [
              DropdownMenuItem(value: '', child: Text(t('allStatuses'))),
              DropdownMenuItem(value: 'available', child: Text(t('available'))),
              DropdownMenuItem(value: 'reserved', child: Text(t('reserved'))),
              DropdownMenuItem(value: 'used', child: Text(t('used'))),
              DropdownMenuItem(value: 'expired', child: Text(t('expired'))),
              DropdownMenuItem(value: 'revoked', child: Text(t('revoked'))),
            ],
            onChanged: (v) {
              setState(() => status = v ?? '');
              _load();
            },
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton(onPressed: busy ? null : _load, child: Text(t('search'))),
          ),
          const SizedBox(height: 12),
          if (loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.6)),
            )
          else if (rows.isEmpty)
            EmptyState(message: t('noGuestLinks'), icon: Icons.link_off)
          else
            ...rows.map((row) {
              final st = '${row['status'] ?? ''}';
              final entitlement = row['entitlement'];
              final ref = row['reference']?.toString() ??
                  (entitlement is Map ? '${entitlement['reference'] ?? row['id']}' : '${row['id']}');
              return Card(
                child: ListTile(
                  title: Text(ref, style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                  subtitle: Text('$st · ${formatDate(row['created_at']?.toString())}'),
                  trailing: st == 'available' || st == 'reserved'
                      ? TextButton(
                          onPressed: busy ? null : () => _revoke(row),
                          child: Text(t('revoke')),
                        )
                      : null,
                ),
              );
            }),
        ],
      ),
    );
  }
}
