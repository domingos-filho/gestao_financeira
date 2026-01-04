# Gestao Financeira Offline-First

Aplicativo de controle financeiro compartilhado (casal) com PWA offline-first, sync por eventos e backend em NestJS.

## Stack

- Web: Next.js 14 (App Router), PWA, Dexie, TanStack Query, Tailwind + shadcn/ui
- API: NestJS, Prisma, PostgreSQL, JWT + Refresh Token
- Infra: Docker, docker-compose, monorepo

## Estrutura

```
/apps
  /web        -> Next.js PWA
  /api        -> NestJS API
/packages
  /shared     -> DTOs, enums, schemas
```

## Requisitos

- Node.js 20+
- Docker (opcional, recomendado para prod)

## Configuracao (local)

Crie um arquivo `.env` na raiz do `apps/api`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gestao_financeira?schema=public
JWT_SECRET=change_me_access
REFRESH_TOKEN_SECRET=change_me_refresh
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
ADMIN_EMAIL=fadomingosf@gmail.com
PORT=3001
```

No frontend, opcionalmente defina:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_EMAIL=fadomingosf@gmail.com
```

## Executar localmente (sem Docker)

```
npm install
npm -w packages/shared run build
npm -w apps/api run prisma:generate
npm -w apps/api run prisma:migrate
npm -w apps/api run start:dev
npm -w apps/web run dev
```

## Executar com Docker (local)

```
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

## Checklist de producao

- Definir `JWT_SECRET` e `REFRESH_TOKEN_SECRET` fortes
- Ajustar `NEXT_PUBLIC_API_URL` para a URL publica da API
- Garantir HTTPS no dominio do PWA
- Verificar backups do volume `pgdata`
- Revisar limites de rate-limit conforme carga
- Monitorar logs do `api` e do `web`

## Observacoes

- Tokens sao armazenados no `localStorage` para permitir uso offline
- O sync usa eventos idempotentes e `server_seq` por carteira (last-write-wins)
- Transacoes offline ficam em IndexedDB e sincronizam ao reconectar

## Sync offline-first (resumo)

- Cliente grava eventos localmente (IndexedDB)
- PUSH envia eventos pendentes
- PULL traz eventos novos por `server_seq`
- Servidor aplica eventos, materializa estado e resolve conflitos (last-write-wins)

## Endpoints principais

- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /wallets
- GET /wallets
- POST /wallets/:id/members
- GET /wallets/:id/categories
- POST /wallets/:id/categories
- PATCH /wallets/:id/categories/:categoryId
- GET /wallets/:id/debts
- POST /wallets/:id/debts
- PATCH /wallets/:id/debts/:debtId
- GET /users/access (admin)
- POST /users/access (admin)
- DELETE /users/access/:email (admin)
- POST /sync/push
- GET /sync/pull?walletId=...&sinceSeq=...

## Deploy (EasyPanel)

- Use apenas o `docker-compose.yml` (sem publicar portas no host)
- Configure as variaveis do `api` e o `NEXT_PUBLIC_API_URL` (build-time) do `web`
- O dominio deve apontar para as portas internas: web `3000`, api `3001`
- Remova qualquer mapeamento de porta (ex.: `3000:3000`) no servico

## Deploy em VPS via GitHub + Docker Compose (sem EasyPanel)

1) No servidor, clone o repositorio:

```
git clone <seu-repo>
cd gestao_financeira
```

2) Crie um arquivo `.env` na raiz baseado em `.env.example` e ajuste:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=senha_forte
POSTGRES_DB=gestao_financeira
JWT_SECRET=segredo_forte_access
REFRESH_TOKEN_SECRET=segredo_forte_refresh
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
ADMIN_EMAIL=fadomingosf@gmail.com
WEB_DOMAIN=appfinanceiro.domingos-automacoes.shop
API_DOMAIN=api.domingos-automacoes.shop
NEXT_PUBLIC_API_URL=https://api.domingos-automacoes.shop
NEXT_PUBLIC_ADMIN_EMAIL=fadomingosf@gmail.com
# API_PORT/WEB_PORT sao usados apenas no docker-compose.local.yml
API_PORT=3001
WEB_PORT=4000
```

3) Garanta DNS apontando os subdominios para o IP da VPS.

4) Suba os containers com portas no host:

```
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

5) Acesse:

- Web: `https://seudominio.com` (ou `http://IP:WEB_PORT`)
- API: `https://api.seudominio.com` (ou `http://IP:API_PORT`)

Observacao: no EasyPanel, o TLS e o proxy reverso ja sao gerenciados pela plataforma.

## Proxy local (opcional, fora do EasyPanel)

Se quiser subir direto na VPS sem EasyPanel e usar o Caddy do repo:

```
docker compose --profile proxy up --build -d
```

Isso usa o `Caddyfile` e expose 80/443 no host.
