import 'package:material_ui/material_ui.dart';

/// Tokens do `docs/design-system.md` (versão adaptada ao AgroIntegra).
abstract final class AppColors {
  static const Color brand = Color(0xFF1F5A3D);
  static const Color brandDark = Color(0xFF17472F);
  static const Color background = Color(0xFFF3F4F3);
  static const Color card = Color(0xFFFFFFFF);
  static const Color ink = Color(0xFF1B2420);
  static const Color muted = Color(0xFF55605A);
  static const Color line = Color(0xFFD5D9D6);
  static const Color success = Color(0xFF1E6B3A);
  static const Color warning = Color(0xFF8A5A00);
  static const Color danger = Color(0xFFA12A1B);
}

abstract final class AppTheme {
  /// Cantos de 2 a 4 px (regra do design system).
  static const BorderRadius radius = BorderRadius.all(Radius.circular(4));

  static ThemeData light() {
    final ColorScheme scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.brand,
          brightness: Brightness.light,
        ).copyWith(
          primary: AppColors.brand,
          onPrimary: Colors.white,
          surface: AppColors.card,
          onSurface: AppColors.ink,
          error: AppColors.danger,
          outline: AppColors.line,
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        centerTitle: false,
      ),
      // Toques de no mínimo 48 dp, com a ação principal em botão largo.
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brand,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: const RoundedRectangleBorder(borderRadius: radius),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
