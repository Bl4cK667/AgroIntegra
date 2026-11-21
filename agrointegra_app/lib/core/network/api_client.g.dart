// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_client.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(sessionHolder)
final sessionHolderProvider = SessionHolderProvider._();

final class SessionHolderProvider
    extends $FunctionalProvider<SessionHolder, SessionHolder, SessionHolder>
    with $Provider<SessionHolder> {
  SessionHolderProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'sessionHolderProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$sessionHolderHash();

  @$internal
  @override
  $ProviderElement<SessionHolder> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  SessionHolder create(Ref ref) {
    return sessionHolder(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SessionHolder value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SessionHolder>(value),
    );
  }
}

String _$sessionHolderHash() => r'81e472ef422f0f0c8b23cf24ad79c12f0bdaece5';

/// Cliente HTTP da API: envia `Authorization` e `X-Organization-Id` quando há sessão.

@ProviderFor(apiClient)
final apiClientProvider = ApiClientProvider._();

/// Cliente HTTP da API: envia `Authorization` e `X-Organization-Id` quando há sessão.

final class ApiClientProvider extends $FunctionalProvider<Dio, Dio, Dio>
    with $Provider<Dio> {
  /// Cliente HTTP da API: envia `Authorization` e `X-Organization-Id` quando há sessão.
  ApiClientProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'apiClientProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$apiClientHash();

  @$internal
  @override
  $ProviderElement<Dio> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Dio create(Ref ref) {
    return apiClient(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Dio value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Dio>(value),
    );
  }
}

String _$apiClientHash() => r'79bed7bf94698555baccfc5771e3c3b9b8d78ac4';
