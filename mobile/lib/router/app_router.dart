import 'package:go_router/go_router.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/screens/auth_screens.dart';
import 'package:loyalty_mobile/screens/feature_screens.dart';
import 'package:loyalty_mobile/screens/shell_and_home.dart';
import 'package:loyalty_mobile/screens/spinwheel_screens.dart';

GoRouter createRouter(AuthProvider auth) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (context, state) {
      final loggingIn = auth.loading;
      final loc = state.matchedLocation;
      final isAuthRoute = loc == '/landing' ||
          loc == '/signin' ||
          loc == '/signup' ||
          loc == '/forgot-password' ||
          loc.startsWith('/guest/');
      final isSplash = loc == '/';

      if (loggingIn) return isSplash ? null : '/';

      if (!auth.isLoggedIn) {
        if (loc.startsWith('/app')) return '/signin';
        return null;
      }

      if (!auth.isCustomer) {
        return isAuthRoute || isSplash ? null : '/landing';
      }

      if (isAuthRoute || isSplash) return '/app';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/landing', builder: (_, __) => const LandingScreen()),
      GoRoute(path: '/signin', builder: (_, __) => const SignInScreen()),
      GoRoute(
        path: '/signup',
        builder: (_, state) => SignUpScreen(
          referral: state.uri.queryParameters['ref'] ??
              state.uri.queryParameters['referral'],
        ),
      ),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/guest/:token',
        builder: (_, state) => GuestSpinScreen(token: state.pathParameters['token']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/app', builder: (_, __) => const MembershipScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/spinwheel', builder: (_, __) => const CustomerSpinScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/history', builder: (_, __) => const HistoryScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/rewards', builder: (_, __) => const RewardsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/more', builder: (_, __) => const MoreScreen()),
          ]),
        ],
      ),
      GoRoute(path: '/app/history/:id', builder: (_, state) => ReceiptScreen(id: state.pathParameters['id']!)),
      GoRoute(path: '/app/points', builder: (_, __) => const PointsScreen()),
      GoRoute(path: '/app/missions', builder: (_, __) => const MissionsScreen()),
      GoRoute(path: '/app/community', builder: (_, __) => const CommunityScreen()),
      GoRoute(
        path: '/app/reviews',
        builder: (_, state) => ReviewsScreen(
          productCode: state.uri.queryParameters['product_code'],
          productName: state.uri.queryParameters['product_name'],
        ),
      ),
      GoRoute(path: '/app/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/app/settings', builder: (_, __) => const SettingsScreen()),
      GoRoute(path: '/app/settings/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/app/settings/password', builder: (_, __) => const PasswordScreen()),
      GoRoute(path: '/app/settings/faq', builder: (_, __) => const FaqScreen()),
      GoRoute(path: '/app/settings/about', builder: (_, __) => const AboutScreen()),
      GoRoute(path: '/app/help', builder: (_, __) => const HelpScreen()),
      GoRoute(path: '/app/help/:id', builder: (_, state) => HelpDetailScreen(id: state.pathParameters['id']!)),
    ],
  );
}
