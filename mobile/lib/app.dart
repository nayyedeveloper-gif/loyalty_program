import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:loyalty_mobile/core/storage/app_storage.dart';
import 'package:loyalty_mobile/core/theme/app_theme.dart';
import 'package:loyalty_mobile/providers/app_settings_provider.dart';
import 'package:loyalty_mobile/providers/auth_provider.dart';
import 'package:loyalty_mobile/providers/language_provider.dart';
import 'package:loyalty_mobile/providers/notification_provider.dart';
import 'package:loyalty_mobile/providers/theme_provider.dart';
import 'package:loyalty_mobile/router/app_router.dart';

class LoyaltyApp extends StatefulWidget {
  const LoyaltyApp({super.key});

  @override
  State<LoyaltyApp> createState() => _LoyaltyAppState();
}

class _LoyaltyAppState extends State<LoyaltyApp> {
  late final AppStorage storage = AppStorage();
  late final AuthProvider auth = AuthProvider(storage);
  late final GoRouter router = createRouter(auth);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => LanguageProvider(storage)),
        ChangeNotifierProvider(create: (_) => ThemeProvider(storage)),
        ChangeNotifierProvider(create: (_) => NotificationProvider(auth)),
        ChangeNotifierProvider(create: (_) => AppSettingsProvider(auth.api)),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, theme, _) {
          return MaterialApp.router(
            title: '29 Gold Membership',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: theme.mode,
            routerConfig: router,
          );
        },
      ),
    );
  }
}
