# Deploy no Umbrel com Portainer

Este ambiente usa imagens prontas do GHCR. O Portainer nao compila o monorepo no servidor, evitando falhas de rede durante `apk`, `apt` ou `npm install` e reduzindo o uso de CPU e memoria do home lab.

## Antes de implantar

As imagens `latest` sao publicadas quando a branch `main` recebe um push. Portanto, primeiro integre na `main` a versao do projeto que deseja publicar e aguarde o workflow **Publish Docker Images** concluir no GitHub Actions.

No GitHub, confirme tambem que os pacotes abaixo estao publicos ou configure o GHCR em **Portainer > Registries**:

- `ghcr.io/domingos-filho/gestao-financeira-api`
- `ghcr.io/domingos-filho/gestao-financeira-web`

## Criar o stack pelo Git

No Portainer, remova o stack com erro somente depois de confirmar que nao ha um volume de banco com dados que precise ser preservado. Em seguida, crie um novo stack com:

```text
Repository URL: https://github.com/domingos-filho/gestao_financeira.git
Repository reference: refs/heads/main
Compose path: deploy/portainer/docker-compose.yml
```

O campo **Repository reference** nao pode ficar vazio. `main` tambem costuma funcionar, mas `refs/heads/main` evita ambiguidade.

Cadastre estas variaveis no proprio stack do Portainer:

```text
POSTGRES_USER=postgres
POSTGRES_PASSWORD=use_uma_senha_forte_alfanumerica
POSTGRES_DB=gestao_financeira
JWT_SECRET=use_um_segredo_longo_e_aleatorio
REFRESH_TOKEN_SECRET=use_outro_segredo_longo_e_aleatorio
ADMIN_EMAIL=fadomingosf@gmail.com
ADMIN_PASSWORD=use_uma_senha_forte_para_o_admin
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
WEB_PORT=4000
IMAGE_TAG=latest
```

Use valores diferentes para as tres senhas/segredos. Para `POSTGRES_PASSWORD`, prefira letras e numeros; caracteres reservados em URL, como `@`, `:`, `/`, `?` e `#`, precisam ser percent-encoded dentro de `DATABASE_URL`.

Depois do deploy, valide na rede local:

```text
http://IP_DO_UMBREL:4000
```

A API e o banco nao publicam portas no host. Os servicos usam a rede padrao privada do stack e se encontram pelos nomes `api` e `postgres`. O frontend acessa `http://api:3001` e oferece a API ao navegador pelo proxy same-origin `/api`.

## Publicar com Cloudflare Tunnel

HTTPS e o caminho recomendado para uso completo do login e do PWA. O refresh token usa cookie `Secure` em producao e nao deve ser exposto por HTTP simples.

1. No painel Cloudflare, crie um Tunnel gerenciado remotamente.
2. Copie somente o token do comando Docker fornecido pela Cloudflare.
3. Adicione ao stack do Portainer:

```text
COMPOSE_PROFILES=tunnel
CLOUDFLARE_TUNNEL_TOKEN=cole_o_token_aqui
```

4. No **Public Hostname** do Tunnel, configure:

```text
Hostname: appfinanceiro.seu-dominio.com
Service type: HTTP
URL: web:3000
```

Nao crie um hostname publico separado para a API. Todas as chamadas do navegador devem continuar chegando ao frontend em `/api`.

O token do Tunnel concede acesso para executar o conector. Mantenha-o somente nas variaveis protegidas do Portainer e rotacione-o se for exposto.

## Atualizacoes

Ative **GitOps updates** e **Re-pull image** no Portainer, ou use **Pull and redeploy** depois que o workflow do GitHub terminar. O manifesto usa `pull_policy: always`, mas o redeploy ainda precisa ser disparado.

## Diagnostico rapido

- `Ref: missing`: edite/recrie o stack com `refs/heads/main`.
- Erro em `apk add --no-cache openssl`: o stack esta usando o `docker-compose.yml` da raiz e tentando compilar no Umbrel. Use `deploy/portainer/docker-compose.yml`.
- `manifest unknown` ou `unauthorized`: aguarde o GitHub Actions e torne os pacotes GHCR publicos ou autentique o registry.
- `no matching manifest`: confira `uname -m`; o workflow publica `linux/amd64` e `linux/arm64`.
- API reiniciando: confira primeiro `DATABASE_URL`/senha do Postgres e depois os logs de migracao Prisma.
- `P1001` em `postgres:5432`: confirme que `postgres` e `api` aparecem na mesma rede `<nome-do-stack>_default`. O PostgreSQL e iniciado aceitando TCP em todas as interfaces do container, e seu healthcheck valida especificamente `127.0.0.1:5432`. A API aguarda a porta por ate 120 segundos e registra separadamente erros de DNS, conexao recusada, rota e timeout.
- Login funciona e depois perde a sessao na LAN: acesse pelo hostname HTTPS do Cloudflare Tunnel; o cookie de refresh e `Secure` em producao.
