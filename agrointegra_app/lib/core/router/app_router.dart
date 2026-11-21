import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../features/auth/create_pin_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/organization_screen.dart';
import '../../features/auth/unlock_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/producers/producer_detail_screen.dart';
import '../../features/producers/producer_form_screen.dart';
import '../../features/producers/producers_screen.dart';
import '../../features/properties/property_detail_screen.dart';
import '../../features/properties/property_form_screen.dart';
import '../../features/requests/request_detail_screen.dart';
import '../../features/requests/request_form_screen.dart';
import '../../features/requests/requests_screen.dart';
import '../../features/sync/pending_screen.dart';
import '../../features/visits/visit_detail_screen.dart';
import '../../features/visits/visit_wizard_screen.dart';
import '../auth/auth_controller.dart';

part 'app_router.g.dart';

abstract final class AppRoutes {
  static const String home = '/';
  static const String loading = '/carregando';
  static const String login = '/entrar';
  static const String organization = '/organizacao';
  static const String createPin = '/pin/criar';
  static const String unlock = '/pin/desbloquear';
  static const String pending = '/pendencias';
  static const String producers = '/produtores';
  static const String requests = '/solicitacoes';
}

/// Para qual rota o status de autenticação manda.
String? redirectFor(AuthStatus status, String location) {
  const Set<String> authRoutes = {
    AppRoutes.loading,
    AppRoutes.login,
    AppRoutes.organization,
    AppRoutes.createPin,
    AppRoutes.unlock,
  };

  final String? target = switch (status) {
    AuthStatus.loading => AppRoutes.loading,
    AuthStatus.signedOut => AppRoutes.login,
    AuthStatus.chooseOrganization => AppRoutes.organization,
    AuthStatus.createPin => AppRoutes.createPin,
    AuthStatus.locked => AppRoutes.unlock,
    AuthStatus.unlocked => null,
  };

  if (target != null) return location == target ? null : target;
  // Autenticado: tela de entrada volta para a agenda.
  return authRoutes.contains(location) ? AppRoutes.home : null;
}

/// Rotas do app. A agenda é a inicial; o resto depende da sessão.
/// Atenção: rotas fixas (`/novo`, `/nova`) vêm antes das rotas com `:id`.
@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final ValueNotifier<int> refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: AppRoutes.home,
    refreshListenable: refresh,
    redirect: (context, state) {
      final AuthStatus status = ref.read(authProvider).status;
      return redirectFor(status, state.matchedLocation);
    },
    routes: [
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.loading,
        builder: (context, state) => const _LoadingScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.organization,
        builder: (context, state) => const OrganizationScreen(),
      ),
      GoRoute(
        path: AppRoutes.createPin,
        builder: (context, state) => const CreatePinScreen(),
      ),
      GoRoute(
        path: AppRoutes.unlock,
        builder: (context, state) => const UnlockScreen(),
      ),
      GoRoute(
        path: AppRoutes.pending,
        builder: (context, state) => const PendingScreen(),
      ),

      // Produtores
      GoRoute(
        path: AppRoutes.producers,
        builder: (context, state) => const ProducersScreen(),
      ),
      GoRoute(
        path: '/produtores/novo',
        builder: (context, state) => const ProducerFormScreen(),
      ),
      GoRoute(
        path: '/produtores/:id',
        builder: (context, state) =>
            ProducerDetailScreen(producerId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/produtores/:id/editar',
        builder: (context, state) =>
            ProducerFormScreen(producerId: state.pathParameters['id']),
      ),

      // Propriedades
      GoRoute(
        path: '/propriedades/nova',
        builder: (context, state) => PropertyFormScreen(
          producerId: state.uri.queryParameters['producerId'],
        ),
      ),
      GoRoute(
        path: '/propriedades/:id',
        builder: (context, state) =>
            PropertyDetailScreen(propertyId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/propriedades/:id/editar',
        builder: (context, state) =>
            PropertyFormScreen(propertyId: state.pathParameters['id']),
      ),

      // Solicitações
      GoRoute(
        path: AppRoutes.requests,
        builder: (context, state) => const RequestsScreen(),
      ),
      GoRoute(
        path: '/solicitacoes/nova',
        builder: (context, state) => RequestFormScreen(
          producerId: state.uri.queryParameters['producerId'],
        ),
      ),
      GoRoute(
        path: '/solicitacoes/:id',
        builder: (context, state) =>
            RequestDetailScreen(requestId: state.pathParameters['id']!),
      ),

      // Visitas
      GoRoute(
        path: '/visitas/nova',
        builder: (context, state) => VisitWizardScreen(
          producerId: state.uri.queryParameters['producerId'] ?? '',
          propertyId: state.uri.queryParameters['propertyId'],
          requestId: state.uri.queryParameters['requestId'],
        ),
      ),
      GoRoute(
        path: '/visitas/:id',
        builder: (context, state) =>
            VisitDetailScreen(visitId: state.pathParameters['id']!),
      ),
    ],
  );
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
