// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_unlock.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(localUnlock)
final localUnlockProvider = LocalUnlockProvider._();

final class LocalUnlockProvider
    extends $FunctionalProvider<LocalUnlock, LocalUnlock, LocalUnlock>
    with $Provider<LocalUnlock> {
  LocalUnlockProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localUnlockProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localUnlockHash();

  @$internal
  @override
  $ProviderElement<LocalUnlock> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  LocalUnlock create(Ref ref) {
    return localUnlock(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(LocalUnlock value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<LocalUnlock>(value),
    );
  }
}

String _$localUnlockHash() => r'b0650d73d0ccf19fc734e418fc41cf728e4f2dd2';
