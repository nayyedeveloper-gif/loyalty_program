import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/core/utils/formatters.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/providers/notification_provider.dart';
import 'package:loyalty_mobile/providers/theme_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

class AdminShell extends StatelessWidget {
  const AdminShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final unread = context.watch<NotificationProvider>().totalUnread;
    final palette = AppPalette.of(context);
    final isAdmin = context.watch<AuthProvider>().isAdmin;
    return Scaffold(
      body: AppBackground(child: navigationShell),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: palette.navBar,
          border: Border(top: BorderSide(color: palette.line.withValues(alpha: 0.9))),
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (i) {
            navigationShell.goBranch(i, initialLocation: i == navigationShell.currentIndex);
            context.read<NotificationProvider>().refreshUnread();
          },
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.dashboard_outlined),
              selectedIcon: const Icon(Icons.dashboard),
              label: isAdmin ? t('dashboard') : t('home'),
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text('$unread'),
                child: const Icon(Icons.chat_bubble_outline),
              ),
              selectedIcon: const Icon(Icons.chat_bubble),
              label: t('inbox'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.people_outline),
              selectedIcon: const Icon(Icons.people),
              label: t('customers'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.shopping_bag_outlined),
              selectedIcon: const Icon(Icons.shopping_bag),
              label: t('purchases'),
            ),
            NavigationDestination(
              icon: const Icon(Icons.grid_view_rounded),
              selectedIcon: const Icon(Icons.grid_view_rounded),
              label: t('more'),
            ),
          ],
        ),
      ),
    );
  }
}

class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key});
  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  Map<String, dynamic>? data;
  String? error;
  bool loading = true;

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
      final auth = context.read<AuthProvider>();
      if (auth.isAdmin) {
        final res = await auth.api.get('/admin/dashboard');
        setState(() => data = res);
      } else {
        // Staff home: light summary from customers + redemptions counts.
        final customers = await auth.api.get('/admin/customers', params: {'per_page': 1});
        final redemptions = await auth.api.get('/admin/redemptions', params: {'status': 'pending', 'per_page': 1});
        final purchases = await auth.api.get('/admin/purchases', params: {'per_page': 1});
        setState(() {
          data = {
            'stats': {
              'customers': customers['customers']?['total'] ?? 0,
              'purchases': purchases['purchases']?['total'] ?? 0,
              'pending_redemptions': redemptions['redemptions']?['total'] ?? 0,
            },
            'alerts': {
              'pending_redemptions': redemptions['redemptions']?['total'] ?? 0,
            },
          };
        });
      }
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final user = context.watch<AuthProvider>().user;
    final isAdmin = context.watch<AuthProvider>().isAdmin;
    if (loading) return Scaffold(body: LoadingView(label: t('loading')));
    if (error != null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: ErrorBanner(message: error!, onRetry: _load),
          ),
        ),
      );
    }

    final stats = Map<String, dynamic>.from(data?['stats'] as Map? ?? {});
    final alerts = Map<String, dynamic>.from(data?['alerts'] as Map? ?? {});

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(isAdmin ? t('adminPortal') : t('staffPortal'), style: Theme.of(context).textTheme.bodySmall),
                  Text('${t('welcome')}, ${user?.name ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
                  Text(t('dashboardSubtitle'), style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
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
                StatCard(label: t('members'), value: '${stats['customers'] ?? 0}', icon: Icons.people_outline),
                StatCard(label: t('purchases'), value: '${stats['purchases'] ?? 0}', icon: Icons.shopping_bag_outlined),
                if (isAdmin)
                  StatCard(label: t('netRevenue'), value: formatMMK(stats['revenue'] ?? 0), icon: Icons.trending_up),
                if (isAdmin)
                  StatCard(label: t('pointsIssued'), value: formatPoints(stats['points_issued'] ?? 0), icon: Icons.diamond_outlined),
                if (!isAdmin)
                  StatCard(
                    label: t('pendingRedemptions'),
                    value: '${stats['pending_redemptions'] ?? alerts['pending_redemptions'] ?? 0}',
                    icon: Icons.receipt_long_outlined,
                  ),
              ],
            ),
            const SizedBox(height: 18),
            SectionHeader(title: t('quickActions')),
            SettingsTile(icon: Icons.chat_bubble_outline, title: t('inbox'), onTap: () => context.go('/admin/inbox')),
            SettingsTile(icon: Icons.people_outline, title: t('customers'), onTap: () => context.go('/admin/customers')),
            SettingsTile(icon: Icons.add_shopping_cart, title: t('recordPurchase'), onTap: () => context.push('/admin/purchases/new')),
            SettingsTile(icon: Icons.card_giftcard_outlined, title: t('rewardRedemptions'), onTap: () => context.push('/admin/redemptions')),
            SettingsTile(icon: Icons.diamond_outlined, title: t('pointsLedger'), onTap: () => context.push('/admin/ledger')),
            if (isAdmin)
              SettingsTile(
                icon: Icons.donut_large,
                title: t('adminSpinWheel'),
                subtitle: t('adminSpinWheelSubtitle'),
                onTap: () => context.push('/admin/spinwheel'),
              ),
          ],
        ),
      ),
    );
  }
}

class AdminInboxScreen extends StatefulWidget {
  const AdminInboxScreen({super.key});
  @override
  State<AdminInboxScreen> createState() => _AdminInboxScreenState();
}

class _AdminInboxScreenState extends State<AdminInboxScreen> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true;
  String? error;
  final search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AuthProvider>().api.get(
        '/chat/conversations',
        params: {'search': search.text.trim()},
      );
      setState(() {
        rows = (data['conversations'] as List? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
      if (mounted) context.read<NotificationProvider>().refreshUnread();
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
      appBar: AppBar(title: Text(t('inbox'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: search,
              decoration: InputDecoration(
                hintText: t('chatSearchConversations'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
              ),
              onSubmitted: (_) => _load(),
            ),
          ),
          Expanded(
            child: loading
                ? LoadingView(label: t('loading'))
                : error != null
                    ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
                    : rows.isEmpty
                        ? EmptyState(message: t('noConversations'), icon: Icons.chat_bubble_outline)
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              itemCount: rows.length,
                              separatorBuilder: (_, __) => const Divider(height: 1),
                              itemBuilder: (_, i) {
                                final row = rows[i];
                                final customer = row['customer'] is Map ? Map<String, dynamic>.from(row['customer'] as Map) : null;
                                final name = '${customer?['name'] ?? row['customer_name'] ?? t('member')}';
                                final preview = '${row['latest_message']?['body'] ?? row['preview'] ?? ''}';
                                final unread = row['unread_count'] is num ? (row['unread_count'] as num).toInt() : int.tryParse('${row['unread_count']}') ?? 0;
                                return ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: AppPalette.of(context).primarySoft,
                                    child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: TextStyle(color: AppPalette.of(context).onSoft, fontWeight: FontWeight.w800)),
                                  ),
                                  title: Text(name, style: TextStyle(fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w600)),
                                  subtitle: Text(preview, maxLines: 1, overflow: TextOverflow.ellipsis),
                                  trailing: unread > 0 ? Badge(label: Text('$unread')) : const Icon(Icons.chevron_right),
                                  onTap: () => context.push('/admin/inbox/${row['id']}'),
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

class AdminCustomersScreen extends StatefulWidget {
  const AdminCustomersScreen({super.key});
  @override
  State<AdminCustomersScreen> createState() => _AdminCustomersScreenState();
}

class _AdminCustomersScreenState extends State<AdminCustomersScreen> {
  List<Map<String, dynamic>> items = [];
  bool loading = true;
  String? error;
  final search = TextEditingController();
  int page = 1;
  int lastPage = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _load({int? nextPage}) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AuthProvider>().api.get('/admin/customers', params: {
        'search': search.text.trim(),
        'page': nextPage ?? page,
        'per_page': 20,
      });
      final pager = data['customers'] is Map ? Map<String, dynamic>.from(data['customers'] as Map) : <String, dynamic>{};
      setState(() {
        items = (pager['data'] as List? ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        page = pager['current_page'] is int ? pager['current_page'] as int : page;
        lastPage = pager['last_page'] is int ? pager['last_page'] as int : 1;
      });
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('customers'))),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/admin/customers/new'),
        child: const Icon(Icons.person_add_alt_1),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: search,
              decoration: InputDecoration(
                hintText: t('searchCustomers'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(onPressed: () => _load(nextPage: 1), icon: const Icon(Icons.refresh)),
              ),
              onSubmitted: (_) => _load(nextPage: 1),
            ),
          ),
          Expanded(
            child: loading
                ? LoadingView(label: t('loading'))
                : error != null
                    ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: () => _load()))
                    : items.isEmpty
                        ? EmptyState(message: t('noCustomers'), icon: Icons.people_outline)
                        : RefreshIndicator(
                            onRefresh: () => _load(nextPage: 1),
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: items.length + 1,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) {
                                if (i == items.length) {
                                  return Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      TextButton(onPressed: page > 1 ? () => _load(nextPage: page - 1) : null, child: Text(t('previous'))),
                                      Text('$page / $lastPage', style: TextStyle(color: palette.muted)),
                                      TextButton(onPressed: page < lastPage ? () => _load(nextPage: page + 1) : null, child: Text(t('next'))),
                                    ],
                                  );
                                }
                                final c = items[i];
                                return Card(
                                  child: ListTile(
                                    title: Text('${c['name'] ?? ''}', style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                                    subtitle: Text('${c['customer_code'] ?? ''} · ${c['email'] ?? ''}\n${t(c['tier']?.toString() ?? 'care')} · ${formatPoints(c['redeemable_points'])} pts', style: TextStyle(color: palette.inkSoft, height: 1.35)),
                                    isThreeLine: true,
                                    trailing: const Icon(Icons.chevron_right),
                                    onTap: () => context.push('/admin/customers/${c['id']}'),
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

class AdminCustomerFormScreen extends StatefulWidget {
  const AdminCustomerFormScreen({super.key, this.id});
  final String? id;
  @override
  State<AdminCustomerFormScreen> createState() => _AdminCustomerFormScreenState();
}

class _AdminCustomerFormScreenState extends State<AdminCustomerFormScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final address = TextEditingController();
  final password = TextEditingController();
  bool loading = false;
  bool booting = false;
  String? error;

  bool get isEdit => widget.id != null;

  @override
  void initState() {
    super.initState();
    if (isEdit) _boot();
  }

  Future<void> _boot() async {
    setState(() => booting = true);
    try {
      final data = await context.read<AuthProvider>().api.get('/admin/customers/${widget.id}');
      final c = Map<String, dynamic>.from(data['customer'] as Map);
      name.text = '${c['name'] ?? ''}';
      email.text = '${c['email'] ?? ''}';
      phone.text = '${c['phone'] ?? ''}';
      address.text = '${c['address'] ?? ''}';
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => booting = false);
    }
  }

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    phone.dispose();
    address.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final body = <String, dynamic>{
        'name': name.text.trim(),
        'email': email.text.trim(),
        'phone': phone.text.trim(),
        'address': address.text.trim(),
      };
      if (password.text.isNotEmpty) body['password'] = password.text;
      final api = context.read<AuthProvider>().api;
      if (isEdit) {
        await api.put('/admin/customers/${widget.id}', body: body);
      } else {
        if (password.text.isEmpty) {
          setState(() => error = context.read<LanguageProvider>().t('passwordRequired'));
          return;
        }
        body['password'] = password.text;
        await api.post('/admin/customers', body: body);
      }
      if (mounted) context.pop();
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
      appBar: AppBar(title: Text(isEdit ? t('editCustomer') : t('addCustomer'))),
      body: booting
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (error != null) ErrorBanner(message: error!),
                TextField(controller: name, decoration: InputDecoration(labelText: t('name'))),
                const SizedBox(height: 12),
                TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: t('email'))),
                const SizedBox(height: 12),
                TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('phone'))),
                const SizedBox(height: 12),
                TextField(controller: address, decoration: InputDecoration(labelText: t('address'))),
                const SizedBox(height: 12),
                TextField(controller: password, obscureText: true, decoration: InputDecoration(labelText: isEdit ? t('newPasswordOptional') : t('password'))),
                const SizedBox(height: 20),
                GradientButton(label: loading ? t('saving') : t('save'), onPressed: loading ? null : _save),
              ],
            ),
    );
  }
}

class AdminCustomerDetailScreen extends StatefulWidget {
  const AdminCustomerDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<AdminCustomerDetailScreen> createState() => _AdminCustomerDetailScreenState();
}

class _AdminCustomerDetailScreenState extends State<AdminCustomerDetailScreen> {
  Map<String, dynamic>? customer;
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
      final data = await context.read<AuthProvider>().api.get('/admin/customers/${widget.id}');
      setState(() => customer = Map<String, dynamic>.from(data['customer'] as Map));
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    if (loading) return Scaffold(appBar: AppBar(), body: const LoadingView());
    if (error != null || customer == null) {
      return Scaffold(appBar: AppBar(), body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error ?? t('somethingWrong'), onRetry: _load)));
    }
    final c = customer!;
    return Scaffold(
      appBar: AppBar(
        title: Text('${c['name'] ?? ''}'),
        actions: [
          IconButton(onPressed: () => context.push('/admin/customers/${widget.id}/edit'), icon: const Icon(Icons.edit_outlined)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${c['customer_code'] ?? ''}', style: TextStyle(color: palette.muted, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text('${c['email'] ?? ''}', style: TextStyle(color: palette.ink)),
                  Text('${c['phone'] ?? ''}', style: TextStyle(color: palette.inkSoft)),
                  const SizedBox(height: 12),
                  TierPill(tier: '${c['tier'] ?? 'care'}'),
                  const SizedBox(height: 12),
                  Text('${t('redeemablePoints')}: ${formatPoints(c['redeemable_points'])}', style: TextStyle(color: palette.ink, fontWeight: FontWeight.w700)),
                  Text('${t('lifetimeSpend')}: ${formatMMK(c['total_spent'])}', style: TextStyle(color: palette.inkSoft)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          SettingsTile(
            icon: Icons.chat_bubble_outline,
            title: t('openChat'),
            onTap: () async {
              try {
                final data = await context.read<AuthProvider>().api.post('/chat/conversations/start', body: {
                  'customer_id': int.tryParse(widget.id) ?? widget.id,
                });
                final conv = data['conversation'];
                final id = conv is Map ? conv['id'] : data['conversation_id'];
                if (context.mounted && id != null) context.push('/admin/inbox/$id');
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(getErrorMessage(e))));
                }
              }
            },
          ),
          SettingsTile(
            icon: Icons.add_shopping_cart,
            title: t('recordPurchase'),
            onTap: () => context.push('/admin/purchases/new?user_id=${widget.id}&code=${Uri.encodeComponent('${c['customer_code'] ?? ''}')}'),
          ),
        ],
      ),
    );
  }
}

class AdminPurchasesScreen extends StatefulWidget {
  const AdminPurchasesScreen({super.key});
  @override
  State<AdminPurchasesScreen> createState() => _AdminPurchasesScreenState();
}

class _AdminPurchasesScreenState extends State<AdminPurchasesScreen> {
  List<Map<String, dynamic>> items = [];
  bool loading = true;
  String? error;
  final search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AuthProvider>().api.get('/admin/purchases', params: {
        'search': search.text.trim(),
        'per_page': 30,
      });
      final pager = data['purchases'] is Map ? Map<String, dynamic>.from(data['purchases'] as Map) : <String, dynamic>{};
      setState(() {
        items = (pager['data'] as List? ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      });
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('purchases'))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/admin/purchases/new'),
        icon: const Icon(Icons.add),
        label: Text(t('recordPurchase')),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: search,
              decoration: InputDecoration(
                hintText: t('searchPurchases'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
              ),
              onSubmitted: (_) => _load(),
            ),
          ),
          Expanded(
            child: loading
                ? LoadingView(label: t('loading'))
                : error != null
                    ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
                    : items.isEmpty
                        ? EmptyState(message: t('noPurchases'), icon: Icons.shopping_bag_outlined)
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) {
                                final p = items[i];
                                final user = p['user'] is Map ? Map<String, dynamic>.from(p['user'] as Map) : null;
                                final title = p['product_name']?.toString() ??
                                    p['product_code']?.toString() ??
                                    '#${p['id']}';
                                return Card(
                                  child: ListTile(
                                    title: Text(title, style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                                    subtitle: Text('${user?['name'] ?? ''} · ${formatMMK(p['net_amount'] ?? p['amount'])}\n${formatDate(p['sold_at']?.toString())}', style: TextStyle(color: palette.inkSoft, height: 1.35)),
                                    isThreeLine: true,
                                    trailing: Text('+${formatPoints(p['points_earned'])}', style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w700)),
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

class AdminPurchaseFormScreen extends StatefulWidget {
  const AdminPurchaseFormScreen({super.key, this.userId, this.memberCode});
  final String? userId;
  final String? memberCode;
  @override
  State<AdminPurchaseFormScreen> createState() => _AdminPurchaseFormScreenState();
}

class _AdminPurchaseFormScreenState extends State<AdminPurchaseFormScreen> {
  final memberCode = TextEditingController();
  final productName = TextEditingController();
  final productCode = TextEditingController();
  final amount = TextEditingController();
  final pointsRedeem = TextEditingController(text: '0');
  String productType = 'Gold';
  String paymentMethod = 'Cash';
  int? userId;
  String? memberName;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    if (widget.memberCode != null) memberCode.text = widget.memberCode!;
    if (widget.userId != null) userId = int.tryParse(widget.userId!);
    if (memberCode.text.isNotEmpty) _lookupMember();
  }

  @override
  void dispose() {
    memberCode.dispose();
    productName.dispose();
    productCode.dispose();
    amount.dispose();
    pointsRedeem.dispose();
    super.dispose();
  }

  Future<void> _lookupMember() async {
    final code = memberCode.text.trim().toUpperCase();
    if (code.isEmpty) return;
    try {
      final data = await context.read<AuthProvider>().api.get('/admin/customers', params: {
        'search': code,
        'per_page': 20,
      });
      final rows = (data['customers']?['data'] as List? ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e));
      final match = rows.cast<Map<String, dynamic>?>().firstWhere(
            (c) => '${c?['customer_code'] ?? ''}'.toUpperCase() == code,
            orElse: () => rows.isNotEmpty ? rows.first : null,
          );
      if (!mounted) return;
      if (match == null) {
        setState(() {
          userId = null;
          memberName = null;
          error = context.read<LanguageProvider>().t('memberNotFound');
        });
        return;
      }
      setState(() {
        userId = match['id'] is int ? match['id'] as int : int.tryParse('${match['id']}');
        memberName = '${match['name'] ?? ''}';
        error = null;
      });
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    }
  }

  Future<void> _save() async {
    if (userId == null) {
      setState(() => error = context.read<LanguageProvider>().t('memberNotFound'));
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await context.read<AuthProvider>().api.post(
        '/admin/purchases',
        body: {
          'user_id': userId,
          'product_name': productName.text.trim(),
          'product_code': productCode.text.trim(),
          'product_type': productType,
          'amount': num.tryParse(amount.text.trim()) ?? 0,
          'points_to_redeem': num.tryParse(pointsRedeem.text.trim()) ?? 0,
          'payment_method': paymentMethod,
          'grant_spins': 0,
        },
        extraHeaders: {'Idempotency-Key': const Uuid().v4()},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.read<LanguageProvider>().t('purchaseRecorded'))));
        context.pop();
      }
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('recordPurchase'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null) ErrorBanner(message: error!),
          TextField(
            controller: memberCode,
            decoration: InputDecoration(
              labelText: t('customerId'),
              suffixIcon: IconButton(onPressed: _lookupMember, icon: const Icon(Icons.search)),
            ),
            textCapitalization: TextCapitalization.characters,
            onSubmitted: (_) => _lookupMember(),
          ),
          if (memberName != null) ...[
            const SizedBox(height: 8),
            SuccessBanner(message: memberName!),
          ],
          const SizedBox(height: 12),
          TextField(controller: productName, decoration: InputDecoration(labelText: t('productName'))),
          const SizedBox(height: 12),
          TextField(controller: productCode, decoration: InputDecoration(labelText: t('productCode'))),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: productType,
            decoration: InputDecoration(labelText: t('productType')),
            items: ['Gold', 'Diamond', 'Jewellery', 'Other']
                .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                .toList(),
            onChanged: (v) => setState(() => productType = v ?? 'Gold'),
          ),
          const SizedBox(height: 12),
          TextField(controller: amount, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('amount'))),
          const SizedBox(height: 12),
          TextField(controller: pointsRedeem, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('pointsToRedeem'))),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: paymentMethod,
            decoration: InputDecoration(labelText: t('payment')),
            items: ['Cash', 'Card', 'Transfer', 'Mixed']
                .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                .toList(),
            onChanged: (v) => setState(() => paymentMethod = v ?? 'Cash'),
          ),
          const SizedBox(height: 20),
          GradientButton(label: saving ? t('saving') : t('save'), onPressed: saving ? null : _save),
        ],
      ),
    );
  }
}

class AdminRedemptionsScreen extends StatefulWidget {
  const AdminRedemptionsScreen({super.key});
  @override
  State<AdminRedemptionsScreen> createState() => _AdminRedemptionsScreenState();
}

class _AdminRedemptionsScreenState extends State<AdminRedemptionsScreen> {
  List<Map<String, dynamic>> items = [];
  bool loading = true;
  String? error;
  String status = 'pending';

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
      final data = await context.read<AuthProvider>().api.get('/admin/redemptions', params: {
        if (status != 'all') 'status': status,
        'per_page': 40,
      });
      final pager = data['redemptions'] is Map ? Map<String, dynamic>.from(data['redemptions'] as Map) : <String, dynamic>{};
      setState(() {
        items = (pager['data'] as List? ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      });
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _update(int id, String next) async {
    try {
      await context.read<AuthProvider>().api.put('/admin/redemptions/$id', body: {'status': next});
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
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('rewardRedemptions'))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'pending', label: Text(t('pending'))),
                ButtonSegment(value: 'collected', label: Text(t('collected'))),
                ButtonSegment(value: 'cancelled', label: Text(t('cancelled'))),
                const ButtonSegment(value: 'all', label: Text('All')),
              ],
              selected: {status},
              onSelectionChanged: (s) {
                setState(() => status = s.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: loading
                ? const LoadingView()
                : error != null
                    ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
                    : items.isEmpty
                        ? EmptyState(message: t('noRedemptions'), icon: Icons.card_giftcard_outlined)
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: items.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (_, i) {
                                final r = items[i];
                                final reward = r['reward_item'] is Map ? Map<String, dynamic>.from(r['reward_item'] as Map) : null;
                                final user = r['user'] is Map ? Map<String, dynamic>.from(r['user'] as Map) : null;
                                final id = r['id'] is int ? r['id'] as int : int.tryParse('${r['id']}') ?? 0;
                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('${reward?['title'] ?? t('reward')}', style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                                        Text('${user?['name'] ?? ''} · ${r['redemption_code'] ?? ''}', style: TextStyle(color: palette.inkSoft)),
                                        Text('${formatPoints(r['points_spent'])} pts · ${r['status']}', style: TextStyle(color: palette.muted)),
                                        if ('${r['status']}' == 'pending') ...[
                                          const SizedBox(height: 10),
                                          Row(
                                            children: [
                                              FilledButton(onPressed: () => _update(id, 'collected'), child: Text(t('markCollected'))),
                                              const SizedBox(width: 8),
                                              OutlinedButton(onPressed: () => _update(id, 'cancelled'), child: Text(t('cancel'))),
                                            ],
                                          ),
                                        ],
                                      ],
                                    ),
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

class AdminLedgerScreen extends StatefulWidget {
  const AdminLedgerScreen({super.key});
  @override
  State<AdminLedgerScreen> createState() => _AdminLedgerScreenState();
}

class _AdminLedgerScreenState extends State<AdminLedgerScreen> {
  List<Map<String, dynamic>> items = [];
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
      final data = await context.read<AuthProvider>().api.get('/admin/ledger', params: {'per_page': 40});
      final pager = data['ledger'] is Map
          ? Map<String, dynamic>.from(data['ledger'] as Map)
          : data['entries'] is Map
              ? Map<String, dynamic>.from(data['entries'] as Map)
              : <String, dynamic>{};
      final list = pager['data'] ?? data['ledger'] ?? data['entries'] ?? [];
      setState(() {
        items = (list as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      });
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t('pointsLedger'))),
      body: loading
          ? const LoadingView()
          : error != null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!, onRetry: _load))
              : items.isEmpty
                  ? EmptyState(message: t('noLedger'), icon: Icons.diamond_outlined)
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final e = items[i];
                          final pts = e['points'] ?? e['amount'] ?? 0;
                          final n = pts is num ? pts : num.tryParse('$pts') ?? 0;
                          return Card(
                            child: ListTile(
                              title: Text('${e['type'] ?? e['reason'] ?? t('pointsActivity')}', style: TextStyle(fontWeight: FontWeight.w700, color: palette.ink)),
                              subtitle: Text('${e['user']?['name'] ?? ''} · ${formatDate(e['created_at']?.toString())}', style: TextStyle(color: palette.inkSoft)),
                              trailing: Text(
                                '${n >= 0 ? '+' : ''}${formatPoints(n)}',
                                style: TextStyle(color: n >= 0 ? AppColors.ok : AppColors.danger, fontWeight: FontWeight.w800),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

class AdminMoreScreen extends StatelessWidget {
  const AdminMoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final auth = context.watch<AuthProvider>();
    final theme = context.watch<ThemeProvider>();
    final lang = context.watch<LanguageProvider>();
    final notif = context.watch<NotificationProvider>();
    return Scaffold(
      appBar: AppBar(title: Text(t('more'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              title: Text(auth.user?.name ?? '', style: TextStyle(fontWeight: FontWeight.w700, color: AppPalette.of(context).ink)),
              subtitle: Text('${auth.isAdmin ? t('adminPortal') : t('staffPortal')} · ${auth.user?.email ?? ''}'),
            ),
          ),
          const SizedBox(height: 12),
          SettingsTile(icon: Icons.card_giftcard_outlined, title: t('rewardRedemptions'), onTap: () => context.push('/admin/redemptions')),
          SettingsTile(icon: Icons.diamond_outlined, title: t('pointsLedger'), onTap: () => context.push('/admin/ledger')),
          if (auth.isAdmin)
            SettingsTile(
              icon: Icons.donut_large,
              title: t('adminSpinWheel'),
              subtitle: t('adminSpinWheelSubtitle'),
              onTap: () => context.push('/admin/spinwheel'),
            ),
          SettingsTile(
            icon: Icons.notifications_outlined,
            title: t('notifications'),
            trailing: notif.unread > 0 ? Badge(label: Text('${notif.unread}')) : null,
            onTap: () => context.push('/admin/notifications'),
          ),
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
