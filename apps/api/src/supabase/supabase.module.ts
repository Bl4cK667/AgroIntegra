import { Global, Module } from '@nestjs/common';
import { loadSupabaseConfig, SUPABASE_CONFIG } from './supabase.config';
import { SUPABASE_AUTH_TIMEOUT_MS, SUPABASE_FETCH, SupabaseAuthClient } from './supabase-auth.client';
import { SupabaseIdentityService } from './supabase-identity.service';
import { defaultJwksFetcher, JWKS_FETCHER, SupabaseJwtVerifier } from './supabase-jwt.verifier';

// Módulo opt-in: com SUPABASE_AUTH_ENABLED ausente/false nada aqui faz chamadas de rede.
// A configuração é validada no boot; erro de configuração impede a API de subir.
// Não cobre refresh/logout/revogação de sessão Supabase, RLS nem Storage (ver supabase.config.ts).
@Global()
@Module({
  providers: [
    { provide: SUPABASE_CONFIG, useFactory: () => loadSupabaseConfig(process.env) },
    { provide: JWKS_FETCHER, useValue: defaultJwksFetcher },
    { provide: SUPABASE_FETCH, useValue: (url: string, init: RequestInit) => fetch(url, init) },
    { provide: SUPABASE_AUTH_TIMEOUT_MS, useValue: 5000 },
    SupabaseJwtVerifier,
    SupabaseIdentityService,
    SupabaseAuthClient,
  ],
  exports: [SUPABASE_CONFIG, SupabaseJwtVerifier, SupabaseIdentityService, SupabaseAuthClient],
})
export class SupabaseModule {}
