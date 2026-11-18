import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import {
  createLoginRateLimiter,
  createRequestRateLimiter,
  loginRateLimitOptions,
  registrationRateLimitOptions,
  resolveCorsOrigins,
  resolveTrustProxy,
  securityHeaders,
} from './common/http-security';
import { setupOpenApi } from './common/openapi';

// Configuração comum ao servidor e aos testes.
export function configureApp(app: INestApplication, env: Record<string, string | undefined> = process.env) {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  const trustProxy = resolveTrustProxy(env);
  if (trustProxy) express.set('trust proxy', trustProxy);

  // Visitas trazem até 3 fotos e a assinatura em base64.
  express.useBodyParser('json', { limit: '12mb' });
  app.use(securityHeaders);
  app.use('/auth/login', createLoginRateLimiter(loginRateLimitOptions(env)));
  // Cadastro por convite: limite por IP antes do processamento (bucket único para as duas rotas).
  app.use(['/auth/registration', '/auth/register'], createRequestRateLimiter(registrationRateLimitOptions(env)));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  // Content-Disposition liberado para o painel saber o nome do PDF.
  const origins = resolveCorsOrigins(env);
  app.enableCors({ origin: origins.length === 1 ? origins[0] : origins, exposedHeaders: ['Content-Disposition'] });
  // OpenAPI em /docs (desligado em produção, salvo API_DOCS_ENABLED=true).
  setupOpenApi(app, env);
}
