import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

// Configuração comum ao servidor e aos testes.
export function configureApp(app: INestApplication) {
  // Visitas trazem até 3 fotos e a assinatura em base64.
  (app as NestExpressApplication).useBodyParser('json', { limit: '12mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Content-Disposition liberado para o painel saber o nome do PDF.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', exposedHeaders: ['Content-Disposition'] });
}
