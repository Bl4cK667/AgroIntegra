import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

type Env = Record<string, string | undefined>;

// Documentação OpenAPI em /docs (interface) e /docs/openapi.json.
// API_DOCS_ENABLED=true|false decide; sem a variável, liga fora de produção (NODE_ENV !== 'production').
export function openApiEnabled(env: Env = process.env): boolean {
  const flag = env.API_DOCS_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export function setupOpenApi(app: INestApplication, env: Env = process.env) {
  if (!openApiEnabled(env)) return;
  const config = new DocumentBuilder()
    .setTitle('AgroIntegra API')
    .setDescription(
      'API do AgroIntegra (assistência técnica rural). Autenticação: Bearer JWT obtido em POST /auth/login. ' +
        'Toda rota protegida opera somente na organização do usuário logado.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
}
