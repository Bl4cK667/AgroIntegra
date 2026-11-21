// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_remote.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(syncRemote)
final syncRemoteProvider = SyncRemoteProvider._();

final class SyncRemoteProvider
    extends $FunctionalProvider<SyncRemote, SyncRemote, SyncRemote>
    with $Provider<SyncRemote> {
  SyncRemoteProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncRemoteProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncRemoteHash();

  @$internal
  @override
  $ProviderElement<SyncRemote> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  SyncRemote create(Ref ref) {
    return syncRemote(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SyncRemote value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SyncRemote>(value),
    );
  }
}

String _$syncRemoteHash() => r'0ce527533f3e5804221253fb860db22c8bd4ea4a';
