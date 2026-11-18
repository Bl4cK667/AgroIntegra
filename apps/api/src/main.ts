import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  // Adaptador explícito: no monorepo, o npm pode deixar @nestjs/core na raiz e
  // @nestjs/platform-express em apps/api/node_modules; sem isto o core não acha o driver HTTP.
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  configureApp(app);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API do AgroIntegra em http://localhost:${port}`);
}
bootstrap();
