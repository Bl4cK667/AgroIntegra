// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Dispara a sincronização (ao desbloquear, ao voltar a internet e pelo botão) e guarda o status para a UI.

@ProviderFor(SyncController)
final syncControllerProvider = SyncControllerProvider._();

/// Dispara a sincronização (ao desbloquear, ao voltar a internet e pelo botão) e guarda o status para a UI.
final class SyncControllerProvider
    extends $NotifierProvider<SyncController, SyncStatus> {
  /// Dispara a sincronização (ao desbloquear, ao voltar a internet e pelo botão) e guarda o status para a UI.
  SyncControllerProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncControllerProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncControllerHash();

  @$internal
  @override
  SyncController create() => SyncController();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SyncStatus value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SyncStatus>(value),
    );
  }
}

String _$syncControllerHash() => r'75696f08b0c91747eae65593a4007c6f85124240';

/// Dispara a sincronização (ao desbloquear, ao voltar a internet e pelo botão) e guarda o status para a UI.

abstract class _$SyncController extends $Notifier<SyncStatus> {
  SyncStatus build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<SyncStatus, SyncStatus>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<SyncStatus, SyncStatus>,
              SyncStatus,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
