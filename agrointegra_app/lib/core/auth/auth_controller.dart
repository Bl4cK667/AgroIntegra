import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../network/api_client.dart';
import '../strings/app_strings.dart';
import 'auth_repository.dart';
import 'local_unlock.dart';
import 'session.dart';
import 'session_store.dart';

part 'auth_controller.g.dart';

enum AuthStatus {
  loading,
  signedOut,
  chooseOrganization,
  createPin,
  locked,
  unlocked,
}

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.busy = false,
    this.errorMessage,
  });

  final AuthStatus status;
  final Session? session;
  final bool busy;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    Session? session,
    bool? busy,
    String? errorMessage,
    bool clearError = false,
    bool clearSession = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: clearSession ? null : (session ?? this.session),
      busy: busy ?? this.busy,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// Estado de entrada do app: login, organização, PIN e desbloqueio offline.
@Riverpod(keepAlive: true)
class Auth extends _$Auth {
  @override
  AuthState build() {
    Future<void>.microtask(_restore);
    return const AuthState(status: AuthStatus.loading);
  }

  SessionStore get _store => ref.read(sessionStoreProvider);
  SessionHolder get _holder => ref.read(sessionHolderProvider);

  Future<void> _restore() async {
    final Session? session = await _store.readSession();
    if (session == null) {
      state = const AuthState(status: AuthStatus.signedOut);
      return;
    }
    _holder.current = session;
    if (!session.hasOrganization) {
      state = AuthState(
        status: AuthStatus.chooseOrganization,
        session: session,
      );
      return;
    }
    // Com sessão salva, o app sempre abre pelo PIN ou pela biometria (funciona sem internet).
    final bool hasPin = await _store.hasPin();
    state = AuthState(
      status: hasPin ? AuthStatus.locked : AuthStatus.createPin,
      session: session,
    );
  }

  Future<void> signIn(String email, String password) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final Session session = await ref
          .read(authRepositoryProvider)
          .login(email, password);
      await _store.writeSession(session);
      _holder.current = session;
      await _afterAuthentication(session);
    } on AuthException catch (e) {
      state = state.copyWith(busy: false, errorMessage: e.message);
    }
  }

  Future<void> chooseOrganization(String organizationId) async {
    final Session? current = state.session;
    if (current == null) return;
    final Session updated = current.withOrganization(organizationId);
    await _store.writeSession(updated);
    _holder.current = updated;
    await _afterAuthentication(updated);
  }

  Future<void> _afterAuthentication(Session session) async {
    final bool hasPin = await _store.hasPin();
    state = AuthState(
      status: hasPin ? AuthStatus.unlocked : AuthStatus.createPin,
      session: session,
    );
  }

  /// Retorna `null` se salvou; ou a mensagem de erro para a tela.
  Future<String?> createPin(String pin, String confirmation) async {
    if (!_isValidPin(pin)) return AppStrings.pinInvalid;
    if (pin != confirmation) return AppStrings.pinMismatch;
    await _store.savePin(pin);
    state = state.copyWith(status: AuthStatus.unlocked, clearError: true);
    return null;
  }

  Future<void> unlockWithPin(String pin) async {
    final PinCheckResult check = await _store.checkPin(pin);
    switch (check.result) {
      case PinCheck.ok:
        state = state.copyWith(status: AuthStatus.unlocked, clearError: true);
      case PinCheck.wrong:
        state = state.copyWith(
          errorMessage: AppStrings.pinWrong(check.attemptsLeft),
        );
      case PinCheck.lockedOut:
        await _endSession(message: AppStrings.pinLockedOut);
    }
  }

  Future<void> unlockWithBiometric() async {
    final bool ok = await ref.read(localUnlockProvider).authenticate();
    if (ok) {
      state = state.copyWith(status: AuthStatus.unlocked, clearError: true);
    }
  }

  /// Sair: apaga sessão e PIN. Pendências de sincronização serão tratadas na fase D.
  Future<void> signOut() => _endSession();

  Future<void> _endSession({String? message}) async {
    _holder.current = null;
    await _store.clearAuth();
    state = AuthState(status: AuthStatus.signedOut, errorMessage: message);
  }

  static bool _isValidPin(String pin) => RegExp(r'^\d{4,6}$').hasMatch(pin);
}
