// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_engine.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(syncStore)
final syncStoreProvider = SyncStoreProvider._();

final class SyncStoreProvider
    extends
        $FunctionalProvider<
          AsyncValue<SyncStore>,
          SyncStore,
          FutureOr<SyncStore>
        >
    with $FutureModifier<SyncStore>, $FutureProvider<SyncStore> {
  SyncStoreProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncStoreProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncStoreHash();

  @$internal
  @override
  $FutureProviderElement<SyncStore> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<SyncStore> create(Ref ref) {
    return syncStore(ref);
  }
}

String _$syncStoreHash() => r'e2207c6b0bc18356df08f55a5aac080b678b0e04';

@ProviderFor(syncClock)
final syncClockProvider = SyncClockProvider._();

final class SyncClockProvider
    extends $FunctionalProvider<SyncClock, SyncClock, SyncClock>
    with $Provider<SyncClock> {
  SyncClockProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncClockProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncClockHash();

  @$internal
  @override
  $ProviderElement<SyncClock> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  SyncClock create(Ref ref) {
    return syncClock(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SyncClock value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SyncClock>(value),
    );
  }
}

String _$syncClockHash() => r'e74c366e28665503824ecf01fb8c423c80d6532f';

@ProviderFor(syncEngine)
final syncEngineProvider = SyncEngineProvider._();

final class SyncEngineProvider
    extends
        $FunctionalProvider<
          AsyncValue<SyncEngine>,
          SyncEngine,
          FutureOr<SyncEngine>
        >
    with $FutureModifier<SyncEngine>, $FutureProvider<SyncEngine> {
  SyncEngineProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncEngineProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncEngineHash();

  @$internal
  @override
  $FutureProviderElement<SyncEngine> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<SyncEngine> create(Ref ref) {
    return syncEngine(ref);
  }
}

String _$syncEngineHash() => r'c1e46800828bcd2bec61e0b59ca3b6278b7a4918';
