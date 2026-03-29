# Deploy no Easypanel

Este projeto fica mais simples no Easypanel com 3 servicos:

1. `postgres` como **Postgres Service** gerenciado pelo painel.
2. `gestao-financeira-api` como **App Service** usando a imagem Docker da API.
3. `gestao-financeira-web` como **App Service** usando a imagem Docker do frontend.

## Imagens publicadas pelo GitHub

Depois do push na branch `main`, o workflow `.github/workflows/publish-images.yml` publica:

- `ghcr.io/<seu-usuario>/gestao-financeira-api:latest`
- `ghcr.io/<seu-usuario>/gestao-financeira-web:latest`

Se o pacote do GHCR ficar privado, torne-o publico no GitHub Packages ou configure credenciais de registry no Easypanel.

## 1. Criar o banco no Easypanel

Crie um `Postgres Service` no mesmo projeto. O Easypanel mostra host, porta, banco, usuario e senha do servico.

Monte a `DATABASE_URL` da API neste formato:

```text
postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public
```

## 2. Criar o servico da API

- Tipo: `App Service`
- Source: `Docker Image`
- Image: `ghcr.io/<seu-usuario>/gestao-financeira-api:latest`
- Internal Port: `3001`
- Domain: `api.seu-dominio.com`

Variaveis recomendadas:

```text
PORT=3001
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:PORTA/BANCO?schema=public
JWT_SECRET=troque-por-um-segredo-forte
REFRESH_TOKEN_SECRET=troque-por-um-segredo-forte
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
ADMIN_EMAIL=fadomingosf@gmail.com
```

Health check sugerido:

- Path: `/health`

## 3. Criar o servico do frontend

- Tipo: `App Service`
- Source: `Docker Image`
- Image: `ghcr.io/<seu-usuario>/gestao-financeira-web:latest`
- Internal Port: `3000`
- Domain: `app.seu-dominio.com`

Variaveis recomendadas:

```text
PORT=3000
HOSTNAME=0.0.0.0
API_PUBLIC_URL=https://api.seu-dominio.com
NEXT_PUBLIC_ADMIN_EMAIL=fadomingosf@gmail.com
```

Observacao:

- `API_PUBLIC_URL` e lida em runtime pelo frontend, entao voce nao precisa rebuildar a imagem para trocar o dominio da API.

## 4. Primeira subida

1. Faça push do repositorio para o GitHub.
2. Aguarde o workflow publicar as imagens no GHCR.
3. Crie os 3 servicos no Easypanel.
4. Acesse primeiro `https://api.seu-dominio.com/health`.
5. Depois abra `https://app.seu-dominio.com`.

## 5. Atualizacoes futuras

Cada push na `main` publica novas imagens. Para atualizar no Easypanel, basta redeployar os servicos `api` e `web`.
