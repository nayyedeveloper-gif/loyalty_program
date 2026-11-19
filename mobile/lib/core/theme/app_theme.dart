import 'package:flutter/material.dart';

class AppColors {
  static const primary = Color(0xFF3B82F6);
  static const primaryDark = Color(0xFF2563EB);
  static const primaryLight = Color(0xFF60A5FA);
  static const primarySoft = Color(0xFFDBEAFE);
  static const background = Color(0xFFF3F7FF);
  static const backgroundDark = Color(0xFF0A1222);
  static const surface = Colors.white;
  static const surface2 = Color(0xFFEEF4FF);
  static const ink = Color(0xFF111827);
  static const inkSoft = Color(0xFF1F2937);
  static const muted = Color(0xFF475569);
  static const line = Color(0xFFDBE4F5);
  static const ok = Color(0xFF059669);
  static const danger = Color(0xFFDC2626);
  static const mist = Color(0xFFF8FBFF);
  static const onSoft = Color(0xFF1E3A8A);

  static const surfaceDark = Color(0xFF111827);
  static const surface2Dark = Color(0xFF1E293B);
  static const inkDark = Color(0xFFE2E8F0);
  static const inkSoftDark = Color(0xFFCBD5E1);
  static const mutedDark = Color(0xFF94A3B8);
  static const lineDark = Color(0xFF334155);
  static const mistDark = Color(0xFF0F172A);
  static const primarySoftDark = Color(0xFF1E3A5F);
  static const onSoftDark = Color(0xFFBFDBFE);

  static const gradientPrimary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryLight, primary, primaryDark],
  );

  static const gradientApp = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFF7FAFF), Color(0xFFEEF4FF), Color(0xFFF8FAFC)],
  );

  static const gradientAppDark = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF0D1730), Color(0xFF0A1222), Color(0xFF070E1A)],
  );

  static const gradientHero = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1D4ED8), Color(0xFF2563EB), Color(0xFF3B82F6)],
  );

  static const gradientMembership = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1D4ED8), Color(0xFF3B82F6), Color(0xFF38BDF8)],
  );
}

/// Theme-aware colors so screens stop hardcoding light-only values.
class AppPalette {
  AppPalette._(this.isDark);

  factory AppPalette.of(BuildContext context) =>
      AppPalette._(Theme.of(context).brightness == Brightness.dark);

  final bool isDark;

  Color get background => isDark ? AppColors.backgroundDark : AppColors.background;
  Color get surface => isDark ? AppColors.surfaceDark : AppColors.surface;
  Color get surface2 => isDark ? AppColors.surface2Dark : AppColors.surface2;
  Color get ink => isDark ? AppColors.inkDark : AppColors.ink;
  Color get inkSoft => isDark ? AppColors.inkSoftDark : AppColors.inkSoft;
  Color get muted => isDark ? AppColors.mutedDark : AppColors.muted;
  Color get line => isDark ? AppColors.lineDark : AppColors.line;
  Color get mist => isDark ? AppColors.mistDark : AppColors.mist;
  Color get primarySoft => isDark ? AppColors.primarySoftDark : AppColors.primarySoft;
  Color get onSoft => isDark ? AppColors.onSoftDark : AppColors.onSoft;
  Color get navBar => isDark ? AppColors.surfaceDark : Colors.white;
  Color get card => surface;
  LinearGradient get appGradient => isDark ? AppColors.gradientAppDark : AppColors.gradientApp;
}

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
      primary: AppColors.primary,
      onPrimary: Colors.white,
      secondary: AppColors.primaryLight,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
      onSurfaceVariant: AppColors.inkSoft,
      error: AppColors.danger,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      dividerColor: AppColors.line,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        textColor: AppColors.ink,
        iconColor: AppColors.primaryDark,
        subtitleTextStyle: TextStyle(color: AppColors.inkSoft, fontSize: 13, height: 1.35),
        titleTextStyle: TextStyle(color: AppColors.ink, fontSize: 15, fontWeight: FontWeight.w600),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: AppColors.primarySoft,
        disabledColor: AppColors.surface2,
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.inkSoft),
        secondaryLabelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.onSoft),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        side: const BorderSide(color: AppColors.line),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primarySoft,
          disabledForegroundColor: AppColors.onSoft,
          elevation: 0,
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryDark,
          side: const BorderSide(color: AppColors.primary, width: 1.2),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.primaryDark),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.primaryDark,
        unselectedLabelColor: AppColors.inkSoft,
        indicatorColor: AppColors.primary,
        dividerColor: AppColors.line,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: const TextStyle(color: AppColors.muted),
        labelStyle: const TextStyle(color: AppColors.inkSoft),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: AppColors.primarySoft,
        elevation: 0,
        height: 68,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? AppColors.primaryDark : AppColors.inkSoft, size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? AppColors.primaryDark : AppColors.inkSoft,
          );
        }),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        titleTextStyle: const TextStyle(color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w700),
        contentTextStyle: const TextStyle(color: AppColors.inkSoft, fontSize: 14, height: 1.4),
      ),
      textTheme: const TextTheme(
        displaySmall: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 28),
        headlineMedium: TextStyle(fontWeight: FontWeight.w800, color: AppColors.ink, fontSize: 24),
        headlineSmall: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink, fontSize: 20),
        titleLarge: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink, fontSize: 18),
        titleMedium: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink, fontSize: 16),
        bodyLarge: TextStyle(color: AppColors.ink, fontSize: 15, height: 1.45),
        bodyMedium: TextStyle(color: AppColors.inkSoft, fontSize: 14, height: 1.45),
        bodySmall: TextStyle(color: AppColors.inkSoft, fontSize: 12, height: 1.4),
        labelLarge: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.ink),
        labelMedium: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppColors.inkSoft),
      ),
    );
  }

  static ThemeData dark() {
    const onDark = AppColors.inkDark;
    const muted = AppColors.inkSoftDark;
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primaryLight,
      brightness: Brightness.dark,
      primary: AppColors.primaryLight,
      onPrimary: AppColors.backgroundDark,
      secondary: AppColors.primary,
      surface: AppColors.surfaceDark,
      onSurface: onDark,
      onSurfaceVariant: muted,
      error: const Color(0xFFF87171),
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.backgroundDark,
      dividerColor: AppColors.lineDark,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surfaceDark,
        foregroundColor: onDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: onDark,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        iconTheme: IconThemeData(color: onDark),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceDark,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.lineDark),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        textColor: onDark,
        iconColor: AppColors.primaryLight,
        subtitleTextStyle: TextStyle(color: muted, fontSize: 13, height: 1.35),
        titleTextStyle: TextStyle(color: onDark, fontSize: 15, fontWeight: FontWeight.w600),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surface2Dark,
        selectedColor: AppColors.primarySoftDark,
        disabledColor: AppColors.mistDark,
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: onDark),
        secondaryLabelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.onSoftDark),
        side: const BorderSide(color: AppColors.lineDark),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primaryLight,
          foregroundColor: AppColors.backgroundDark,
          disabledBackgroundColor: AppColors.primarySoftDark,
          disabledForegroundColor: AppColors.onSoftDark,
          elevation: 0,
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryLight,
          side: const BorderSide(color: AppColors.primaryLight, width: 1.2),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.primaryLight),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: AppColors.primaryLight,
        unselectedLabelColor: muted,
        indicatorColor: AppColors.primaryLight,
        dividerColor: AppColors.lineDark,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface2Dark,
        hintStyle: const TextStyle(color: AppColors.mutedDark),
        labelStyle: const TextStyle(color: muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lineDark),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lineDark),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primaryLight, width: 1.6),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surfaceDark,
        indicatorColor: AppColors.primary.withValues(alpha: 0.28),
        elevation: 0,
        height: 68,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? AppColors.primaryLight : muted, size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? AppColors.primaryLight : muted,
          );
        }),
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.surfaceDark,
        titleTextStyle: TextStyle(color: onDark, fontSize: 18, fontWeight: FontWeight.w700),
        contentTextStyle: TextStyle(color: muted, fontSize: 14, height: 1.4),
      ),
      textTheme: const TextTheme(
        displaySmall: TextStyle(fontWeight: FontWeight.w800, color: onDark, fontSize: 28),
        headlineMedium: TextStyle(fontWeight: FontWeight.w800, color: onDark, fontSize: 24),
        headlineSmall: TextStyle(fontWeight: FontWeight.w700, color: onDark, fontSize: 20),
        titleLarge: TextStyle(fontWeight: FontWeight.w700, color: onDark, fontSize: 18),
        titleMedium: TextStyle(fontWeight: FontWeight.w700, color: onDark, fontSize: 16),
        bodyLarge: TextStyle(color: onDark, fontSize: 15, height: 1.45),
        bodyMedium: TextStyle(color: muted, fontSize: 14, height: 1.45),
        bodySmall: TextStyle(color: muted, fontSize: 12, height: 1.4),
        labelLarge: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: onDark),
        labelMedium: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: muted),
      ),
    );
  }
}
