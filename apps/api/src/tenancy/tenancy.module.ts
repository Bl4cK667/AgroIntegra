import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TenancyService } from './tenancy.service';

// Global: PrismaService (composição escopada), AuthGuard e serviços de domínio usam o mesmo contexto.
// O middleware é de módulo (roda DEPOIS dos body-parsers do Express): se rodasse antes, o
// AsyncLocalStorage perderia o contexto quando o parser retoma no callback do stream.
@Global()
@Module({ providers: [TenancyService], exports: [TenancyService] })
export class TenancyModule implements NestModule {
  constructor(private readonly tenancy: TenancyService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(this.tenancy.middleware()).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
