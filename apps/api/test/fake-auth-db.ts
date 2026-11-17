// Dublês em memória para testes unitários de auth/convites/tenancy. Nada de banco real nem rede.
import { Prisma } from '@prisma/client';
import { SupabaseAuthError, SupabaseAuthUser } from '../src/supabase/supabase-auth.client';

type Row = Record<string, unknown> & { id: string };
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${String(++seq).padStart(4, '0')}`;

function matches(row: Row, where: Record<string, unknown> | undefined, db: FakeAuthDb): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Record<string, unknown>[]).some((w) => matches(row, w, db));
    if (key === 'organization' && cond && typeof cond === 'object') {
      const org = db.organizations.find((o) => o.id === row.organizationId);
      return !!org && matches(org, cond as Record<string, unknown>, db);
    }
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (cond && typeof cond === 'object') {
      const c = cond as { gt?: Date; lt?: Date };
      if (c.gt) return value instanceof Date && value.getTime() > c.gt.getTime();
      if (c.lt) return value instanceof Date && value.getTime() < c.lt.getTime();
      return false;
    }
    return value === cond;
  });
}

function pick(row: Row, select: Record<string, unknown> | undefined, db: FakeAuthDb): Record<string, unknown> {
  if (!select) return { ...row };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(select)) {
    if (k === 'organization' && v && typeof v === 'object') {
      const org = db.organizations.find((o) => o.id === row.organizationId)!;
      out[k] = pick(org, (v as { select: Record<string, unknown> }).select, db);
    } else if (v) out[k] = row[k];
  }
  return out;
}

const uniqueError = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

export class FakeAuthDb {
  organizations: Row[] = [];
  users: Row[] = [];
  memberships: Row[] = [];
  invitations: Row[] = [];
  // Permite simular falha na escrita local (ex.: queda do banco no meio do cadastro).
  failNextUserCreate: Error | null = null;
  // Gancho chamado dentro da transação de cadastro (para simular revogação concorrente).
  onTransaction: (() => void) | null = null;

  addOrganization(over: Partial<Row> = {}) {
    const org = { id: over.id ?? nextId('org'), name: 'Secretaria de Teste', active: true, createdAt: new Date(), ...over } as Row;
    this.organizations.push(org);
    return org;
  }

  addUser(over: Partial<Row> = {}) {
    const user = {
      id: nextId('user'),
      name: 'Pessoa Teste',
      email: `pessoa${seq}@exemplo.test`,
      passwordHash: 'x',
      role: 'TECHNICIAN',
      active: true,
      authUserId: null,
      phone: null,
      navStyle: 'topbar',
      theme: null,
      createdAt: new Date(),
      ...over,
    } as Row;
    this.users.push(user);
    return user;
  }

  addMembership(userId: string, organizationId: string, role = 'TECHNICIAN', over: Partial<Row> = {}) {
    const m = { id: nextId('mem'), userId, organizationId, role, active: true, createdAt: new Date(Date.now() + seq), ...over } as Row;
    this.memberships.push(m);
    return m;
  }

  addInvitation(over: Partial<Row> = {}) {
    const inv = {
      id: nextId('inv'),
      email: 'convidada@exemplo.test',
      tokenHash: 'hash',
      organizationId: 'org',
      role: 'TECHNICIAN',
      createdById: 'admin',
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      ...over,
    } as Row;
    this.invitations.push(inv);
    return inv;
  }

  private table(rows: () => Row[], prefix: string, unique: string[] = []) {
    const db = this;
    return {
      findUnique: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
        const row = rows().find((r) => matches(r, where, db));
        return row ? pick(row, select, db) : null;
      },
      findFirst: async ({ where, select }: { where?: Record<string, unknown>; select?: Record<string, unknown> }) => {
        const row = rows().find((r) => matches(r, where, db));
        return row ? pick(row, select, db) : null;
      },
      findMany: async ({ where, select, take }: { where?: Record<string, unknown>; select?: Record<string, unknown>; take?: number }) =>
        rows()
          .filter((r) => matches(r, where, db))
          .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
          .slice(0, take ?? Infinity)
          .map((r) => pick(r, select, db)),
      create: async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, unknown> }) => {
        if (prefix === 'user' && db.failNextUserCreate) {
          const err = db.failNextUserCreate;
          db.failNextUserCreate = null;
          throw err;
        }
        for (const field of unique) {
          if (data[field] != null && rows().some((r) => r[field] === data[field])) throw uniqueError();
        }
        const row = { id: nextId(prefix), createdAt: new Date(), usedAt: null, revokedAt: null, ...data } as Row;
        rows().push(row);
        return pick(row, select, db);
      },
      update: async ({ where, data, select }: { where: Record<string, unknown>; data: Record<string, unknown>; select?: Record<string, unknown> }) => {
        const row = rows().find((r) => matches(r, where, db));
        if (!row) throw new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: 'test' });
        Object.assign(row, data);
        return pick(row, select, db);
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        // Síncrono entre o filtro e a escrita: atômico como um UPDATE ... WHERE no Postgres.
        const hit = rows().filter((r) => matches(r, where, db));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    };
  }

  user = this.table(() => this.users, 'user', ['email', 'authUserId']);
  invitation = this.table(() => this.invitations, 'inv', ['tokenHash']);
  organizationMembership = this.table(() => this.memberships, 'mem');
  organization = this.table(() => this.organizations, 'org');

  // Transação interativa com rollback simples (snapshot das tabelas).
  $transaction = async <T>(fn: (tx: this) => Promise<T>): Promise<T> => {
    const snapshot = {
      users: this.users.map((r) => ({ ...r })),
      memberships: this.memberships.map((r) => ({ ...r })),
      invitations: this.invitations.map((r) => ({ ...r })),
    };
    try {
      this.onTransaction?.();
      return await fn(this);
    } catch (err) {
      this.users = snapshot.users;
      this.memberships = snapshot.memberships;
      this.invitations = snapshot.invitations;
      throw err;
    }
  };
}

// Supabase Auth falso: guarda contas em memória e permite injetar falhas.
export class FakeSupabaseAuth {
  enabled = true;
  registrationEnabled = true;
  accounts = new Map<string, { id: string; email: string; password: string }>();
  calls: string[] = [];
  failCreate: SupabaseAuthError | null = null;
  // Simula timeout APÓS a conta ter sido criada remotamente (resposta perdida).
  loseCreateResponse = false;
  failDelete: SupabaseAuthError | null = null;

  async createUser(input: { id: string; email: string; password: string; name: string }): Promise<SupabaseAuthUser> {
    this.calls.push(`create:${input.id}`);
    if (this.failCreate) throw this.failCreate;
    if ([...this.accounts.values()].some((a) => a.email === input.email)) throw new SupabaseAuthError('email_exists', 422);
    this.accounts.set(input.id, { id: input.id, email: input.email, password: input.password });
    if (this.loseCreateResponse) {
      this.loseCreateResponse = false;
      throw new SupabaseAuthError('unavailable');
    }
    return { id: input.id, email: input.email };
  }

  async getUser(id: string) {
    this.calls.push(`get:${id}`);
    const a = this.accounts.get(id);
    return a ? { id: a.id, email: a.email } : null;
  }

  async updatePassword(id: string, password: string) {
    this.calls.push(`update:${id}`);
    const a = this.accounts.get(id);
    if (!a) throw new SupabaseAuthError('not_found', 404);
    a.password = password;
  }

  async deleteUser(id: string) {
    this.calls.push(`delete:${id}`);
    if (this.failDelete) throw this.failDelete;
    this.accounts.delete(id);
  }

  async verifyPassword(email: string, password: string): Promise<SupabaseAuthUser> {
    this.calls.push(`verify:${email}`);
    const a = [...this.accounts.values()].find((x) => x.email === email);
    if (!a || a.password !== password) throw new SupabaseAuthError('invalid_credentials', 400);
    return { id: a.id, email: a.email };
  }

  async changeOwnPassword(email: string, current: string, next: string, expected: string): Promise<SupabaseAuthUser> {
    const user = await this.verifyPassword(email, current);
    if (user.id !== expected) throw new SupabaseAuthError('identity_mismatch');
    this.accounts.get(user.id)!.password = next;
    return user;
  }
}

export class FakeAudit {
  entries: (Record<string, unknown> & { organizationId?: string | null })[] = [];
  constructor(private readonly tenancy?: { current(): { organizationId?: string } | undefined }) {}
  // Preguiçoso como PrismaPromise: o contexto só é lido quando alguém chama .then (não na chamada).
  // Assim os testes pegam auditoria disparada fora do contexto de organização.
  record(entry: Record<string, unknown>): PromiseLike<void> {
    return lazy(() => {
      this.entries.push({ ...entry, organizationId: this.tenancy?.current()?.organizationId ?? null });
    });
  }
}

// Thenable preguiçoso: executa `fn` no primeiro .then, no contexto assíncrono de quem chamou .then.
export function lazy<T>(fn: () => T): PromiseLike<T> {
  let started: Promise<T> | null = null;
  return {
    then(onfulfilled, onrejected) {
      started ??= new Promise<T>((resolve) => resolve(fn()));
      return started.then(onfulfilled, onrejected);
    },
  };
}
