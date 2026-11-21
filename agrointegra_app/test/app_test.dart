import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:agrointegra_app/app.dart';
import 'package:agrointegra_app/core/auth/session_store.dart';
import 'package:agrointegra_app/core/security/key_value_store.dart';
import 'package:agrointegra_app/core/strings/app_strings.dart';

void main() {
  testWidgets('Sem sessão, o app abre no login', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionStoreProvider.overrideWithValue(
            SessionStore(MemoryKeyValueStore()),
          ),
        ],
        child: const AgroIntegraApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text(AppStrings.loginTitle), findsWidgets);
    expect(find.text(AppStrings.loginEmail), findsOneWidget);
    expect(find.text(AppStrings.loginPassword), findsOneWidget);
  });
}
