import type { NextConfig } from 'next';
import { assertNoForbiddenPublicSecrets } from './src/lib/backend-config';

// Valida no build/start do Next.js usando o process.env completo do servidor,
// bloqueando nomes arbitrários de segredos em variáveis NEXT_PUBLIC_*.
assertNoForbiddenPublicSecrets(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
