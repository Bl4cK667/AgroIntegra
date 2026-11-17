-- Preferência de navegação (Topbar padrão para todos, inclusive usuários existentes).
ALTER TABLE "User" ADD COLUMN "navStyle" TEXT NOT NULL DEFAULT 'topbar';
