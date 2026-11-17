import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

// Contexto de organização da requisição atual. Preenchido pelo AuthGuard só depois de validar
// a membership ativa no banco; nunca a partir de dados do cliente sem essa validação.
export interface TenancyContext {
  organizationId?: string;
  userId?: string;
  role?: Role;
}

function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return !!value && (typeof value === 'object' || typeof value === 'function') && typeof (value as PromiseLike<T>).then === 'function';
}

export const NO_ORGANIZATION ='Organização não identificada para esta operação.';

@Injectable()
export class TenancyService {
  private readonly als = new AsyncLocalStorage<TenancyContext>();

  // Executa `callback` num contexto novo e isolado (cópia; não herda nem vaza para o contexto externo).
  // Thenables preguiçosos (ex.: PrismaPromise, que só dispara a query no primeiro .then) são
  // "assimilados" DENTRO do contexto: o .then é chamado de forma síncrona no executor, ainda sob
  // als.run, então a operação começa com a organização certa. Retorno síncrono é preservado.
  run<T>(context: TenancyContext, callback: () => PromiseLike<T>): Promise<T>;
  run<T>(context: TenancyContext, callback: () => T): T;
  run<T>(context: TenancyContext, callback: () => T | PromiseLike<T>): T | Promise<T> {
    return this.als.run({ ...context }, () => {
      const result = callback();
      if (isThenable(result)) return new Promise<T>((resolve, reject) => result.then(resolve, reject));
      return result;
    });
  }

  // Preenche o contexto atual. Falha fechado se não houver contexto (middleware ausente) ou se
  // tentar trocar uma organização já definida nesta requisição.
  set(context: TenancyContext): void {
    const store = this.als.getStore();
    if (!store) throw new Error('TenancyService.set chamado fora de um contexto (middleware de tenancy ausente).');
    if (store.organizationId && context.organizationId && store.organizationId !== context.organizationId) {
      throw new Error('Troca de organização dentro da mesma requisição não é permitida.');
    }
    Object.assign(store, context);
  }

  // Contexto atual, se houver (rotas públicas devolvem {} ou undefined). Cópia somente leitura.
  current(): Readonly<TenancyContext> | undefined {
    const store = this.als.getStore();
    return store ? { ...store } : undefined;
  }

  // Organização obrigatória: para queries escopadas. Lança 403 sem contexto validado.
  organizationId(): string {
    const id = this.als.getStore()?.organizationId;
    if (!id) throw new ForbiddenException(NO_ORGANIZATION);
    return id;
  }

  userId(): string | undefined {
    return this.als.getStore()?.userId;
  }

  // Middleware Express: cada requisição começa num contexto vazio e isolado.
  middleware() {
    return (_req: unknown, _res: unknown, next: () => void) => this.run({}, next);
  }
}
