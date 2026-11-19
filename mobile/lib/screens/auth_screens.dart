import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/core/utils/errors.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/providers/theme_provider.dart';
import 'package:loyalty_mobile/widgets/common_widgets.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _go());
  }

  void _go() {
    final auth = context.read<AuthProvider>();
    if (auth.loading) {
      Future.delayed(const Duration(milliseconds: 180), _go);
      return;
    }
    if (!mounted) return;
    context.go(auth.homeRoute);
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: AppBackground(child: Center(child: BrandMark(size: 88))),
    );
  }
}

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    final lang = context.watch<LanguageProvider>();
    final theme = context.watch<ThemeProvider>();
    final steps = [
      (Icons.person_add_alt_1, t('step1Title'), t('step1Copy')),
      (Icons.shopping_bag_outlined, t('step2Title'), t('step2Copy')),
      (Icons.diamond_outlined, t('step3Title'), t('step3Copy')),
      (Icons.emoji_events_outlined, t('step4Title'), t('step4Copy')),
    ];
    final tiers = [
      ('Care', '1.0x', t('careDesc')),
      ('VIP', '1.2x', t('vipDesc')),
      ('VVIP', '1.5x', t('vvipDesc')),
      ('CIP', '2.0x', t('cipDesc')),
    ];

    return Scaffold(
      body: AppBackground(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
                decoration: const BoxDecoration(gradient: AppColors.gradientHero),
                child: SafeArea(
                  bottom: false,
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const BrandMark(size: 36, showText: false, light: true),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text('29 Jewellery', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                          ),
                          IconButton(
                            onPressed: () => theme.setMode(
                              theme.mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark,
                            ),
                            icon: const Icon(Icons.dark_mode_outlined, color: Colors.white),
                          ),
                          TextButton(
                            onPressed: () => lang.setLang(lang.lang == 'en' ? 'my' : 'en'),
                            child: Text(lang.lang == 'en' ? 'MY' : 'EN', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      const BrandMark(size: 92, light: true),
                      const SizedBox(height: 18),
                      Text(t('landingTagline'), textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Text(t('landingCopy'), textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.88), height: 1.45)),
                      const SizedBox(height: 22),
                      GradientButton(label: t('signIn'), icon: Icons.login, onPressed: () => context.push('/signin')),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.55)),
                          ),
                          onPressed: () => context.push('/signup'),
                          child: Text(t('joinMembership')),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 22, 16, 8),
              sliver: SliverToBoxAdapter(
                child: SectionHeader(title: t('howItWorks'), subtitle: t('howItWorksCopy')),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList.separated(
                itemCount: steps.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final s = steps[i];
                  return Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primarySoft,
                        child: Text('${i + 1}', style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800)),
                      ),
                      title: Text(s.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(s.$3),
                      trailing: Icon(s.$1, color: AppColors.primary),
                    ),
                  );
                },
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
              sliver: SliverToBoxAdapter(child: SectionHeader(title: t('tiersAndPoints'))),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.05,
                ),
                delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    final tier = tiers[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TierPill(tier: tier.$1),
                            const Spacer(),
                            Text(tier.$2, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: AppColors.primaryDark)),
                            const SizedBox(height: 4),
                            Text(tier.$3, style: Theme.of(context).textTheme.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                    );
                  },
                  childCount: tiers.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  bool obscure = true;
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.read<LanguageProvider>().t;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final auth = context.read<AuthProvider>();
      final user = await auth.login(email.text.trim(), password.text);
      if (!mounted) return;
      if (user.isCustomer) {
        final notice = await auth.consumeSpinGrantNotice();
        if (mounted && notice?['message'] != null) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${notice!['message']}')));
        }
      }
      if (mounted) context.go(auth.homeRoute);
    } catch (e) {
      setState(() => error = getErrorMessage(e, t('somethingWrong')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(onPressed: () => context.go('/landing'), icon: const Icon(Icons.arrow_back)),
              ),
              const SizedBox(height: 8),
              const BrandMark(size: 120),
              const SizedBox(height: 20),
              Text(t('welcomeBack'), style: Theme.of(context).textTheme.headlineSmall),
              Text(t('signInSubtitle'), style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 20),
              if (error != null) ErrorBanner(message: error!),
              TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: t('email'), prefixIcon: const Icon(Icons.mail_outline))),
              const SizedBox(height: 12),
              TextField(
                controller: password,
                obscureText: obscure,
                decoration: InputDecoration(
                  labelText: t('password'),
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    onPressed: () => setState(() => obscure = !obscure),
                    icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(onPressed: () => context.push('/forgot-password'), child: Text(t('forgotPassword'))),
              ),
              GradientButton(label: busy ? t('signingIn') : t('signIn'), onPressed: busy ? null : _submit),
              TextButton(onPressed: () => context.push('/signup'), child: Text('${t('newMember')} ${t('createAccount')}')),
            ],
          ),
        ),
      ),
    );
  }
}

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key, this.referral});
  final String? referral;
  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  late final referral = TextEditingController(text: widget.referral ?? '');
  bool busy = false;
  String? error;

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    phone.dispose();
    password.dispose();
    confirm.dispose();
    referral.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final t = context.read<LanguageProvider>().t;
    if (password.text != confirm.text) {
      setState(() => error = 'Passwords do not match');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final user = await context.read<AuthProvider>().register({
        'name': name.text.trim(),
        'email': email.text.trim(),
        'phone': phone.text.trim(),
        'password': password.text,
        'password_confirmation': confirm.text,
        if (referral.text.trim().isNotEmpty) 'referral_code': referral.text.trim(),
      });
      if (!mounted) return;
      if (!user.isCustomer) {
        context.go('/landing');
        return;
      }
      context.go('/app');
    } catch (e) {
      setState(() => error = getErrorMessage(e, t('somethingWrong')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back)),
              ),
              const BrandMark(size: 64),
              const SizedBox(height: 16),
              Text(t('createAccount'), style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 16),
              if (error != null) ErrorBanner(message: error!),
              TextField(controller: name, decoration: InputDecoration(labelText: t('fullName'), prefixIcon: const Icon(Icons.badge_outlined))),
              const SizedBox(height: 10),
              TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: t('email'), prefixIcon: const Icon(Icons.mail_outline))),
              const SizedBox(height: 10),
              TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('phone'), prefixIcon: const Icon(Icons.phone_outlined))),
              const SizedBox(height: 10),
              TextField(controller: password, obscureText: true, decoration: InputDecoration(labelText: t('password'), prefixIcon: const Icon(Icons.lock_outline))),
              const SizedBox(height: 10),
              TextField(controller: confirm, obscureText: true, decoration: InputDecoration(labelText: t('confirmPassword'), prefixIcon: const Icon(Icons.lock_outline))),
              const SizedBox(height: 10),
              TextField(controller: referral, decoration: InputDecoration(labelText: t('referralCode'), prefixIcon: const Icon(Icons.card_giftcard_outlined))),
              const SizedBox(height: 18),
              GradientButton(label: busy ? t('creating') : t('createAccount'), onPressed: busy ? null : _submit),
              TextButton(onPressed: () => context.push('/signin'), child: Text(t('alreadyMember'))),
            ],
          ),
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int step = 0;
  final email = TextEditingController();
  final otp = TextEditingController();
  final password = TextEditingController();
  final confirm = TextEditingController();
  bool busy = false;
  String? error;
  String? debugOtp;
  String? resetToken;

  @override
  void dispose() {
    email.dispose();
    otp.dispose();
    password.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    final auth = context.read<AuthProvider>();
    final t = context.read<LanguageProvider>().t;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (step == 0) {
        final data = await auth.api.post('/auth/forgot-password', body: {'email': email.text.trim()});
        debugOtp = data['debug_otp']?.toString();
        setState(() => step = 1);
      } else if (step == 1) {
        final data = await auth.api.post('/auth/verify-otp', body: {
          'email': email.text.trim(),
          'otp': otp.text.trim(),
        });
        resetToken = data['reset_token']?.toString() ?? data['token']?.toString();
        setState(() => step = 2);
      } else {
        await auth.api.post('/auth/reset-password', body: {
          'email': email.text.trim(),
          'otp': otp.text.trim(),
          if (resetToken != null) 'token': resetToken,
          'password': password.text,
          'password_confirmation': confirm.text,
        });
        if (!mounted) return;
        context.go('/signin');
      }
    } catch (e) {
      setState(() => error = getErrorMessage(e, t('somethingWrong')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<LanguageProvider>().t;
    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back)),
              ),
              Text(t('forgotTitle'), style: Theme.of(context).textTheme.headlineSmall),
              Text(t('forgotSubtitle'), style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 12),
              Row(
                children: List.generate(3, (i) {
                  final active = i <= step;
                  return Expanded(
                    child: Container(
                      height: 4,
                      margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary : AppColors.line,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 16),
              if (error != null) ErrorBanner(message: error!),
              if (debugOtp != null) SuccessBanner(message: 'Debug OTP: $debugOtp'),
              if (step == 0) TextField(controller: email, decoration: InputDecoration(labelText: t('email'))),
              if (step == 1) TextField(controller: otp, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: t('otpLabel'))),
              if (step == 2) ...[
                TextField(controller: password, obscureText: true, decoration: InputDecoration(labelText: t('newPassword'))),
                const SizedBox(height: 10),
                TextField(controller: confirm, obscureText: true, decoration: InputDecoration(labelText: t('confirmPassword'))),
              ],
              const SizedBox(height: 18),
              GradientButton(
                label: busy
                    ? t('loading')
                    : step == 0
                        ? t('sendOtp')
                        : step == 1
                            ? t('verifyOtp')
                            : t('resetPassword'),
                onPressed: busy ? null : _next,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
