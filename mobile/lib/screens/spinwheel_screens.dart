import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_fortune_wheel/flutter_fortune_wheel.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:loyalty_mobile/core/config/app_config.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/core/utils/formatters.dart';
import 'package:loyalty_mobile/models/models.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

const _palette = [
  Color(0xFF1D4ED8),
  Color(0xFFFFFFFF),
  Color(0xFF2563EB),
  Color(0xFFDBEAFE),
  Color(0xFF3B82F6),
  Color(0xFFEFF6FF),
  Color(0xFF60A5FA),
  Color(0xFFF8FBFF),
];

class CustomerSpinScreen extends StatefulWidget {
  const CustomerSpinScreen({super.key});
  @override
  State<CustomerSpinScreen> createState() => _CustomerSpinScreenState();
}

class _CustomerSpinScreenState extends State<CustomerSpinScreen> with SingleTickerProviderStateMixin {
  late final tab = TabController(length: 2, vsync: this);
  late final StreamController<int> fortune = StreamController<int>.broadcast();
  late final ConfettiController confetti = ConfettiController(duration: const Duration(seconds: 3));

  SpinState? state;
  bool loading = true;
  bool spinning = false;
  String? error;
  String? promoNote;
  String? recoverNote;
  String rewardFilter = 'all';
  SpinReward? lastWin;
  int selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _load(recover: true);
  }

  @override
  void dispose() {
    tab.dispose();
    fortune.close();
    confetti.dispose();
    super.dispose();
  }

  Future<void> _load({bool recover = false}) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final auth = context.read<AuthProvider>();
      final results = await Future.wait([
        auth.api.get('/spinwheel/state'),
        auth.api.get('/spinwheel/rewards'),
      ]);
      final merged = Map<String, dynamic>.from(results[0]);
      final rewardsPayload = results[1];
      merged['rewards'] = rewardsPayload is List
          ? rewardsPayload
          : (rewardsPayload['rewards'] ?? rewardsPayload['data'] ?? rewardsPayload);
      setState(() => state = SpinState.fromJson(merged));

      if (recover && auth.user != null) {
        final key = await auth.storage.getPendingSpin(auth.user!.id);
        if (key != null) {
          try {
            final recovered = await auth.api.get('/spinwheel/spins/by-key/$key');
            await auth.storage.setPendingSpin(auth.user!.id, null);
            setState(() => recoverNote = 'Recovered your previous spin result');
            await _present(recovered, animate: false);
          } catch (_) {}
        }
      }
    } catch (e) {
      setState(() => error = getErrorMessage(e, context.read<LanguageProvider>().t('spinUnableLoad')));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  SpinReward _rewardFromPayload(Map<String, dynamic> data) {
    final result = data['result'];
    if (result is Map) return SpinReward.fromJson(Map<String, dynamic>.from(result));
    return SpinReward.fromJson(data);
  }

  Future<void> _present(Map<String, dynamic> data, {required bool animate}) async {
    final index = data['segment_index'] is int
        ? data['segment_index'] as int
        : int.tryParse('${data['segment_index']}') ?? 0;
    final reward = _rewardFromPayload(data);
    final n = math.max(state?.segments.length ?? 1, 1);
    final safeIndex = index.clamp(0, n - 1);

    if (animate && n >= 2) {
      setState(() {
        spinning = true;
        selectedIndex = safeIndex;
      });
      HapticFeedback.mediumImpact();
      fortune.add(safeIndex);
      await Future<void>.delayed(const Duration(milliseconds: 4800));
    }

    if (!mounted) return;
    setState(() {
      spinning = false;
      lastWin = reward;
      selectedIndex = safeIndex;
    });

    HapticFeedback.heavyImpact();
    confetti.play();
    await _showWinSheet(reward);
    await _load();
  }

  Future<void> _spin() async {
    final t = context.read<LanguageProvider>().t;
    if (spinning || (state?.spinsRemaining ?? 0) <= 0) return;
    final ok = await showConfirmDialog(
      context,
      title: t('spinNow'),
      message: t('spinConfirm'),
      confirmLabel: t('confirm'),
      cancelLabel: t('cancel'),
    );
    if (!ok || !mounted) return;

    final auth = context.read<AuthProvider>();
    final key = const Uuid().v4();
    if (auth.user != null) await auth.storage.setPendingSpin(auth.user!.id, key);
    setState(() {
      error = null;
      recoverNote = null;
      spinning = true;
    });

    try {
      final data = await auth.api.post('/spinwheel/spin', body: {'idempotency_key': key});
      if (auth.user != null) await auth.storage.setPendingSpin(auth.user!.id, null);
      await _present(data, animate: true);
    } catch (e) {
      try {
        final recovered = await auth.api.get('/spinwheel/spins/by-key/$key');
        if (auth.user != null) await auth.storage.setPendingSpin(auth.user!.id, null);
        setState(() => recoverNote = 'Recovered spin after a connection issue');
        await _present(recovered, animate: true);
      } catch (_) {
        setState(() {
          spinning = false;
          error = getErrorMessage(e);
        });
      }
    }
  }

  Future<void> _claimPromo() async {
    final promo = state?.pendingPromo;
    if (promo == null) return;
    try {
      final data = await context.read<AuthProvider>().api.post('/spinwheel/promos/${promo.id}/claim');
      setState(() {
        promoNote = context.read<LanguageProvider>().t('spinClaimedSpins', {
          'count': data['granted'] ?? promo.spinCount,
        });
      });
      await _load();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    }
  }

  Future<void> _dismissPromo() async {
    final promo = state?.pendingPromo;
    if (promo == null) return;
    try {
      await context.read<AuthProvider>().api.post('/spinwheel/promos/${promo.id}/dismiss');
      await _load();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    }
  }

  Future<void> _showWinSheet(SpinReward reward) async {
    final t = context.read<LanguageProvider>().t;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RewardDetailSheet(
        reward: reward,
        isWin: true,
        onViewRewards: () {
          Navigator.pop(ctx);
          tab.animateTo(1);
        },
        onClose: () => Navigator.pop(ctx),
        t: t,
      ),
    );
  }

  Future<void> _showRewardDetail(SpinReward reward) async {
    final t = context.read<LanguageProvider>().t;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RewardDetailSheet(
        reward: reward,
        isWin: false,
        onClose: () => Navigator.pop(ctx),
        t: t,
      ),
    );
  }

  void _showHelp() {
    final t = context.read<LanguageProvider>().t;
    final palette = AppPalette.of(context);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: palette.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t('spinHelp'),
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: palette.ink),
            ),
            const SizedBox(height: 10),
            Text(
              state?.helpText?.isNotEmpty == true
                  ? state!.helpText!
                  : 'Use a spin credit, watch the wheel land, then show your reward code in store if collection is required.',
              style: TextStyle(color: palette.inkSoft),
            ),
            const SizedBox(height: 16),
            GradientButton(label: t('done'), onPressed: () => Navigator.pop(ctx)),
          ],
        ),
      ),
    );
  }

  List<SpinReward> get filteredRewards {
    final list = state?.rewards ?? const <SpinReward>[];
    if (rewardFilter == 'all') return list;
    return list.where((r) => r.displayStatus == rewardFilter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final user = context.watch<AuthProvider>().user;
    final segments = state?.segments ?? const <SpinSegment>[];
    final canSpin = !loading && !spinning && (state?.spinsRemaining ?? 0) > 0 && segments.length >= 2;

    return Scaffold(
      body: Stack(
        children: [
          AppBackground(
            child: NestedScrollView(
              headerSliverBuilder: (context, _) => [
                SliverAppBar(
                  floating: true,
                  title: Text(state?.wheelTitle ?? t('spinwheel')),
                  actions: [
                    IconButton(onPressed: _showHelp, icon: const Icon(Icons.help_outline)),
                  ],
                  bottom: TabBar(
                    controller: tab,
                    tabs: [
                      Tab(text: t('wheel')),
                      Tab(text: t('mySpinRewards')),
                    ],
                  ),
                ),
              ],
              body: loading
                  ? const LoadingView()
                  : TabBarView(
                      controller: tab,
                      children: [
                        _WheelTab(
                          t: t,
                          userName: user?.name,
                          customerCode: user?.customerCode,
                          state: state,
                          segments: segments,
                          fortune: fortune.stream,
                          selectedIndex: selectedIndex,
                          spinning: spinning,
                          canSpin: canSpin,
                          error: error,
                          promoNote: promoNote,
                          recoverNote: recoverNote,
                          onSpin: _spin,
                          onClaimPromo: _claimPromo,
                          onDismissPromo: _dismissPromo,
                          onRetry: _load,
                        ),
                        _RewardsTab(
                          t: t,
                          rewards: filteredRewards,
                          filter: rewardFilter,
                          onFilter: (v) => setState(() => rewardFilter = v),
                          onOpen: _showRewardDetail,
                          onGoSpin: () => tab.animateTo(0),
                        ),
                      ],
                    ),
            ),
          ),
          Align(
            alignment: Alignment.topCenter,
            child: ConfettiWidget(
              confettiController: confetti,
              blastDirectionality: BlastDirectionality.explosive,
              shouldLoop: false,
              emissionFrequency: 0.08,
              numberOfParticles: 28,
              maxBlastForce: 28,
              minBlastForce: 10,
              gravity: 0.25,
              colors: const [
                AppColors.primary,
                AppColors.primaryLight,
                AppColors.primaryDark,
                Colors.white,
                Color(0xFF93C5FD),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WheelTab extends StatelessWidget {
  const _WheelTab({
    required this.t,
    required this.userName,
    required this.customerCode,
    required this.state,
    required this.segments,
    required this.fortune,
    required this.selectedIndex,
    required this.spinning,
    required this.canSpin,
    required this.error,
    required this.promoNote,
    required this.recoverNote,
    required this.onSpin,
    required this.onClaimPromo,
    required this.onDismissPromo,
    required this.onRetry,
  });

  final String Function(String, [Map<String, dynamic>?]) t;
  final String? userName;
  final String? customerCode;
  final SpinState? state;
  final List<SpinSegment> segments;
  final Stream<int> fortune;
  final int selectedIndex;
  final bool spinning;
  final bool canSpin;
  final String? error;
  final String? promoNote;
  final String? recoverNote;
  final VoidCallback onSpin;
  final VoidCallback onClaimPromo;
  final VoidCallback onDismissPromo;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRetry,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          if (error != null) ErrorBanner(message: error!, onRetry: onRetry),
          if (promoNote != null) SuccessBanner(message: promoNote!),
          if (recoverNote != null) SuccessBanner(message: recoverNote!),
          if (state?.pendingPromo != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(state!.pendingPromo!.title ?? 'Spin offer', style: const TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(state!.pendingPromo!.message ?? ''),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(child: OutlinedButton(onPressed: onDismissPromo, child: Text(t('dismiss')))),
                        const SizedBox(width: 8),
                        Expanded(child: FilledButton(onPressed: onClaimPromo, child: Text(t('claim')))),
                      ],
                    ),
                  ],
                ),
              ),
            ).animate().fadeIn().slideY(begin: 0.08, end: 0),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(gradient: AppColors.gradientHero),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    state?.wheelTitle ?? t('spinwheel'),
                    style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    state?.wheelSubtitle ??
                        '${userName ?? 'Member'}${customerCode != null ? ' · $customerCode' : ''}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.9)),
                  ),
                ],
              ),
            ),
          ).animate().fadeIn(),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: StatCard(
                  icon: Icons.casino,
                  label: 'Spins left',
                  value: '${state?.spinsRemaining ?? 0}',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: StatCard(
                  icon: Icons.card_giftcard,
                  label: 'Rewards won',
                  value: '${state?.rewards.length ?? 0}',
                ),
              ),
            ],
          ),
          if (state?.expiryGroups.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            ...state!.expiryGroups.map((g) => Text(
                  '${g['count']} spin(s) expire ${formatDate(g['expires_at']?.toString())}',
                  style: Theme.of(context).textTheme.bodySmall,
                )),
          ],
          const SizedBox(height: 16),
          Center(
            child: _PremiumWheel(
              segments: segments,
              selected: fortune,
              highlightIndex: selectedIndex,
              spinning: spinning,
            ),
          ).animate().scale(begin: const Offset(0.92, 0.92), curve: Curves.easeOutBack),
          const SizedBox(height: 20),
          GradientButton(
            label: spinning
                ? 'Spinning…'
                : (state?.spinsRemaining ?? 0) > 0
                    ? t('spinNow')
                    : 'No spins left',
            icon: Icons.auto_awesome,
            onPressed: canSpin ? onSpin : null,
          ),
          const SizedBox(height: 8),
          Text(
            (state?.spinsRemaining ?? 0) > 0
                ? t('spinsRemaining', {'count': state?.spinsRemaining ?? 0})
                : 'Ask staff for a spin credit, or claim a pending promo.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _PremiumWheel extends StatelessWidget {
  const _PremiumWheel({
    required this.segments,
    required this.selected,
    required this.highlightIndex,
    required this.spinning,
  });

  final List<SpinSegment> segments;
  final Stream<int> selected;
  final int highlightIndex;
  final bool spinning;

  Color _sliceColor(SpinSegment segment, int index) {
    final raw = segment.color?.trim();
    if (raw != null && raw.isNotEmpty) {
      final hex = raw.startsWith('#') ? raw.substring(1) : raw;
      if (hex.length == 6) {
        final value = int.tryParse(hex, radix: 16);
        if (value != null) return Color(0xFF000000 | value);
      }
    }
    return _palette[index % _palette.length];
  }

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final items = segments.isEmpty
        ? [
            SpinSegment(index: 0, label: 'Prize'),
            SpinSegment(index: 1, label: 'Try again'),
          ]
        : segments.length == 1
            ? [segments.first, SpinSegment(index: 1, label: '•')]
            : segments;
    final rim = palette.isDark ? palette.surface : Colors.white;

    return Container(
      width: 320,
      height: 320,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.35),
            blurRadius: 28,
            spreadRadius: 2,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: rim, width: 8),
              gradient: const SweepGradient(colors: [
                AppColors.primaryLight,
                AppColors.primary,
                AppColors.primaryDark,
                AppColors.primaryLight,
              ]),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: FortuneWheel(
              selected: selected,
              animateFirst: false,
              duration: const Duration(milliseconds: 4500),
              curve: Curves.easeOutCubic,
              indicators: const [
                FortuneIndicator(
                  alignment: Alignment.topCenter,
                  child: TriangleIndicator(color: Color(0xFF1E3A8A)),
                ),
              ],
              items: [
                for (var i = 0; i < items.length; i++)
                  FortuneItem(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 10),
                      child: _WheelSliceContent(
                        segment: items[i],
                        sliceColor: _sliceColor(items[i], i),
                      ),
                    ),
                    style: FortuneItemStyle(
                      color: _sliceColor(items[i], i),
                      borderColor: rim.withValues(alpha: 0.55),
                      borderWidth: 1.2,
                    ),
                  ),
              ],
            ),
          ),
          IgnorePointer(
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppColors.gradientPrimary,
                border: Border.all(color: rim, width: 3),
                boxShadow: [
                  BoxShadow(color: AppColors.primaryDark.withValues(alpha: 0.35), blurRadius: 12),
                ],
              ),
              child: Icon(
                spinning ? Icons.autorenew : Icons.workspace_premium,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WheelSliceContent extends StatelessWidget {
  const _WheelSliceContent({required this.segment, required this.sliceColor});

  final SpinSegment segment;
  final Color sliceColor;

  @override
  Widget build(BuildContext context) {
    final imageSrc = AppConfig.mediaUrl(segment.imageUrl);
    final light = sliceColor.computeLuminance() > 0.72;
    final labelColor = light ? const Color(0xFF1E3A8A) : Colors.white;
    final label = segment.label.length > 10 ? '${segment.label.substring(0, 10)}…' : segment.label;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (imageSrc.isNotEmpty)
          Container(
            width: 34,
            height: 34,
            margin: const EdgeInsets.only(bottom: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.white.withValues(alpha: 0.92),
              border: Border.all(color: Colors.white70),
            ),
            clipBehavior: Clip.antiAlias,
            child: CachedNetworkImage(
              imageUrl: imageSrc,
              fit: BoxFit.contain,
              errorWidget: (_, __, ___) => Center(
                child: Text(
                  segment.label.isNotEmpty ? segment.label[0].toUpperCase() : '?',
                  style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A)),
                ),
              ),
            ),
          )
        else
          Container(
            width: 28,
            height: 28,
            margin: const EdgeInsets.only(bottom: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.white.withValues(alpha: 0.9),
            ),
            alignment: Alignment.center,
            child: Text(
              segment.label.isNotEmpty ? segment.label[0].toUpperCase() : '?',
              style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A)),
            ),
          ),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 10,
            color: labelColor,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

class _RewardsTab extends StatelessWidget {
  const _RewardsTab({
    required this.t,
    required this.rewards,
    required this.filter,
    required this.onFilter,
    required this.onOpen,
    required this.onGoSpin,
  });

  final String Function(String, [Map<String, dynamic>?]) t;
  final List<SpinReward> rewards;
  final String filter;
  final ValueChanged<String> onFilter;
  final ValueChanged<SpinReward> onOpen;
  final VoidCallback onGoSpin;

  @override
  Widget build(BuildContext context) {
    final filters = {
      'all': t('filterAll'),
      'ready_to_collect': t('readyToCollect'),
      'claimed': t('claimed'),
      'expired': t('expired'),
      'no_collection_required': 'No collect',
    };

    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: filters.entries
                .map((e) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(e.value),
                        selected: filter == e.key,
                        onSelected: (_) => onFilter(e.key),
                      ),
                    ))
                .toList(),
          ),
        ),
        Expanded(
          child: rewards.isEmpty
              ? EmptyState(
                  message: t('empty'),
                  icon: Icons.card_giftcard_outlined,
                  action: TextButton(onPressed: onGoSpin, child: Text(t('spinNow'))),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: rewards.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final r = rewards[i];
                    final palette = AppPalette.of(context);
                    return Card(
                      clipBehavior: Clip.antiAlias,
                      color: palette.surface,
                      child: InkWell(
                        onTap: () => onOpen(r),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 88,
                              height: 88,
                              child: r.imageUrl == null || r.imageUrl!.isEmpty
                                  ? Container(
                                      color: palette.primarySoft,
                                      alignment: Alignment.center,
                                      child: Text(
                                        (r.prizeName ?? '?').characters.first.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 28,
                                          fontWeight: FontWeight.w900,
                                          color: palette.onSoft,
                                        ),
                                      ),
                                    )
                                  : CachedNetworkImage(
                                      imageUrl: AppConfig.mediaUrl(r.imageUrl),
                                      fit: BoxFit.cover,
                                    ),
                            ),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      r.prizeName ?? 'Reward',
                                      style: TextStyle(fontWeight: FontWeight.w800, color: palette.ink),
                                    ),
                                    const SizedBox(height: 4),
                                    _StatusChip(status: r.displayStatus, label: r.statusLabel),
                                    if (r.rewardCode != null) ...[
                                      const SizedBox(height: 4),
                                      Text(r.rewardCode!, style: Theme.of(context).textTheme.bodySmall),
                                    ],
                                    if (r.readyToCollect && r.claimDeadlineAt != null)
                                      Text(
                                        'Collect by ${formatDate(r.claimDeadlineAt)}',
                                        style: TextStyle(fontSize: 12, color: palette.onSoft),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Icon(Icons.chevron_right, color: palette.muted),
                            ),
                          ],
                        ),
                      ),
                    ).animate().fadeIn(delay: (40 * i).ms);
                  },
                ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({this.status, this.label});
  final String? status;
  final String? label;

  Color get color {
    switch (status) {
      case 'ready_to_collect':
        return AppColors.ok;
      case 'claimed':
        return AppColors.primary;
      case 'expired':
        return AppColors.danger;
      default:
        return AppColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label ?? status ?? '',
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _RewardDetailSheet extends StatelessWidget {
  const _RewardDetailSheet({
    required this.reward,
    required this.isWin,
    required this.onClose,
    required this.t,
    this.onViewRewards,
  });

  final SpinReward reward;
  final bool isWin;
  final VoidCallback onClose;
  final VoidCallback? onViewRewards;
  final String Function(String, [Map<String, dynamic>?]) t;

  @override
  Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    return DraggableScrollableSheet(
      initialChildSize: 0.78,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, controller) {
        return Container(
          decoration: BoxDecoration(
            color: palette.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(color: palette.line, borderRadius: BorderRadius.circular(99)),
                ),
              ),
              if (isWin)
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      gradient: AppColors.gradientPrimary,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      reward.isMajor ? 'Major prize!' : t('youWon'),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                    ),
                  ),
                ).animate().scale(curve: Curves.easeOutBack),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: reward.imageUrl == null || reward.imageUrl!.isEmpty
                      ? Container(
                          color: palette.primarySoft,
                          alignment: Alignment.center,
                          child: Text(
                            (reward.prizeName ?? '?').characters.first.toUpperCase(),
                            style: TextStyle(fontSize: 56, fontWeight: FontWeight.w900, color: palette.onSoft),
                          ),
                        )
                      : CachedNetworkImage(imageUrl: AppConfig.mediaUrl(reward.imageUrl), fit: BoxFit.cover),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                reward.prizeName ?? 'Reward',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: palette.ink),
              ),
              const SizedBox(height: 6),
              _StatusChip(status: reward.displayStatus, label: reward.statusLabel),
              if (reward.winningMessage?.isNotEmpty == true) ...[
                const SizedBox(height: 10),
                Text(reward.winningMessage!, style: Theme.of(context).textTheme.bodyLarge),
              ],
              if (reward.description?.isNotEmpty == true) ...[
                const SizedBox(height: 10),
                Text(reward.description!, style: TextStyle(color: palette.inkSoft)),
              ],
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: palette.surface2,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: palette.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reward.readyToCollect ? 'Show this code to staff' : 'Reward reference',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: palette.muted),
                    ),
                    const SizedBox(height: 6),
                    SelectableText(
                      reward.rewardCode ?? '—',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 1, color: palette.ink),
                    ),
                    if (reward.readyToCollect)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'Present this code in store to collect your prize.',
                          style: TextStyle(color: palette.inkSoft),
                        ),
                      ),
                  ],
                ),
              ),
              if (reward.claimDeadlineAt != null) ...[
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.schedule, color: AppColors.primary),
                  title: const Text('Collect by'),
                  subtitle: Text(formatDate(reward.claimDeadlineAt)),
                ),
              ],
              if (reward.instructions?.isNotEmpty == true) ...[
                const SizedBox(height: 4),
                Text('How to collect', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(reward.instructions!),
              ],
              const SizedBox(height: 8),
              Text('Won on ${formatDate(reward.createdAt)}', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 18),
              if (isWin && onViewRewards != null) ...[
                GradientButton(label: 'View prize details', icon: Icons.card_giftcard, onPressed: onViewRewards),
                const SizedBox(height: 8),
              ],
              OutlinedButton(onPressed: onClose, child: Text(isWin ? 'Keep spinning' : t('done'))),
            ],
          ),
        );
      },
    );
  }
}

class GuestSpinScreen extends StatefulWidget {
  const GuestSpinScreen({super.key, required this.token});
  final String token;
  @override
  State<GuestSpinScreen> createState() => _GuestSpinScreenState();
}

class _GuestSpinScreenState extends State<GuestSpinScreen> {
  SpinState? state;
  String? session;
  bool loading = true;
  bool spinning = false;
  String? error;
  late final StreamController<int> fortune = StreamController<int>.broadcast();
  late final ConfettiController confetti = ConfettiController(duration: const Duration(seconds: 3));

  @override
  void initState() {
    super.initState();
    _activate();
  }

  @override
  void dispose() {
    fortune.close();
    confetti.dispose();
    super.dispose();
  }

  Future<void> _activate() async {
    final auth = context.read<AuthProvider>();
    try {
      session = await auth.storage.getGuestSession(widget.token);
      final data = await auth.api.post(
        '/spinwheel/guest/${widget.token}/activate',
        body: {if (session != null) 'guest_session_token': session},
      );
      session = data['guest_session_token']?.toString() ?? session;
      if (session != null) await auth.storage.setGuestSession(widget.token, session);
      if (data['wheel'] is Map || data['segments'] != null) {
        setState(() => state = SpinState.fromJson(data));
      } else if (session != null) {
        final stateData = await auth.api.get('/spinwheel/guest/session', params: {'guest_session_token': session});
        setState(() => state = SpinState.fromJson(stateData));
      }
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _spin() async {
    if (spinning || session == null) return;
    setState(() => spinning = true);
    try {
      final data = await context.read<AuthProvider>().api.post(
            '/spinwheel/guest/spin',
            body: {
              'guest_session_token': session,
              'idempotency_key': const Uuid().v4(),
            },
          );
      final index = data['segment_index'] is int
          ? data['segment_index'] as int
          : int.tryParse('${data['segment_index']}') ?? 0;
      fortune.add(index);
      await Future<void>.delayed(const Duration(milliseconds: 4500));
      if (!mounted) return;
      confetti.play();
      final reward = data['result'] is Map
          ? SpinReward.fromJson(Map<String, dynamic>.from(data['result'] as Map))
          : SpinReward.fromJson(data);
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => _RewardDetailSheet(
          reward: reward,
          isWin: true,
          onClose: () => Navigator.pop(ctx),
          t: context.read<LanguageProvider>().t,
        ),
      );
      await _activate();
    } catch (e) {
      setState(() => error = getErrorMessage(e));
    } finally {
      if (mounted) setState(() => spinning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      appBar: AppBar(title: Text(t('guestSpin'))),
      body: Stack(
        children: [
          AppBackground(
            child: loading
                ? const LoadingView()
                : error != null
                    ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(message: error!))
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _PremiumWheel(
                            segments: state?.segments ?? const [],
                            selected: fortune.stream,
                            highlightIndex: 0,
                            spinning: spinning,
                          ),
                          const SizedBox(height: 20),
                          GradientButton(
                            label: spinning ? t('loading') : t('spinNow'),
                            onPressed: spinning ? null : _spin,
                          ),
                        ],
                      ),
          ),
          Align(
            alignment: Alignment.topCenter,
            child: ConfettiWidget(
              confettiController: confetti,
              blastDirectionality: BlastDirectionality.explosive,
              numberOfParticles: 24,
              colors: const [AppColors.primary, AppColors.primaryLight, Colors.white],
            ),
          ),
        ],
      ),
    );
  }
}
