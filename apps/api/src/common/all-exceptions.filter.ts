import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { HttpResponse } from './http-security';

export const INTERNAL_ERROR = 'Erro interno. Tente novamente em instantes.';

// Erros HTTP conhecidos saem como o Nest já os formata (mensagens de validação e de regra de negócio).
// Qualquer outro erro (Prisma, rede, bug) é registrado no servidor e devolvido como 500 genérico,
// sem stack, SQL, nomes de tabela ou detalhes internos.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<HttpResponse & { headersSent: boolean }>();
    const req = host.switchToHttp().getRequest<{ method?: string; route?: { path?: unknown } }>();
    if (res.headersSent) return;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    // Só contexto seguro: método, padrão da rota (ex.: /producers/:id, sem IDs nem query) e classe do erro.
    // Mensagem e stack não são registradas: podem conter SQL, tokens, URLs ou dados pessoais.
    const route = typeof req.route?.path === 'string' ? req.route.path : '(rota não resolvida)';
    const kind = exception instanceof Error ? exception.constructor.name : typeof exception;
    const code = typeof (exception as { code?: unknown })?.code === 'string' ? ` code=${(exception as { code: string }).code.slice(0, 16)}` : '';
    this.logger.error(`${req.method ?? '?'} ${route} falhou: ${kind}${code}`);
    res.status(500).json({ statusCode: 500, message: INTERNAL_ERROR });
  }
}
