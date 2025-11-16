# Tech Stack

- Aplicação Node.js com Express.
- Use TypeScript e mantenha o código em `src/`.
- Build de produção com `esbuild` gerando `dist/index.js`.
- Utilize `helmet`, `cors`, `express-rate-limit`, `morgan` e `zod` para as responsabilidades indicadas.

## Arquitetura Express

- Entry point: `src/index.ts` inicia o servidor, registra middlewares globais e monta rotas.
- Rotas em `src/routes/` devem ser finas e delegar para camadas abaixo.
- Adote camadas claras:
  - `src/controllers/` lidam com HTTP (req/res) e orquestram serviços.
  - `src/services/` encapsulam regras de negócio.
  - `src/repositories/` acessam dados externos (DB/APIs), mantendo interfaces claras.
  - `src/middleware/` para middlewares reutilizáveis (ex.: `error`, auth, validação).
  - `src/config/` para configuração (ex.: `env.ts`, variáveis de ambiente).
  - `src/lib/` para utilitários (ex.: `logger`).
- Mantenha respostas JSON padronizadas: `{ ok: boolean, data?, error? }`.

## Middlewares e Segurança

- Ative `helmet()` e `cors({ origin: getCorsOrigin() })` cedo no pipeline.
- Gere `req.id` (UUID) e propague em logs e rastreamento.
- Use `express-rate-limit` com limites por minuto e cabeçalhos padrão.
- Configure `app.set('trust proxy', 1)` quando atrás de proxy/load balancer.

## Validação e Erros

- Valide payloads com `zod` no controller ou middleware antes de chamar serviços.
- Não retornar erros brutos; use o `errorHandler` central e `notFound` para 404.
- Padronize mensagens e códigos de status; inclua `req.id` em logs de erro.
- Use `async/await` e capture exceções; evite lógica de negócio dentro de rotas.

## Logging e Observabilidade

- Use `morgan` com token de `id` e ignore `/healthz` e `/readyz`.
- Utilize `logger` para logs estruturados de eventos importantes.
- Trate `unhandledRejection` e `uncaughtException` e finalize o processo com código adequado.
- Implemente shutdown gracioso em `SIGINT`/`SIGTERM` (feche servidor e recursos).

## Configuração

- Defina `PORT` e `CORS_ORIGIN` via ambiente (ex.: `.env` carregado por `dotenv`).
- `getPort()` prioriza `--port` na CLI, depois `PORT`; mantenha valores válidos.
- Não faça hardcode de segredos; nunca logue segredos.

## Princípios SOLID

- Single Responsibility: controllers tratam HTTP; serviços tratam regras de negócio; repositórios tratam dados.
- Open/Closed: projete serviços para serem estendidos por composição, não alterados.
- Liskov Substitution: defina interfaces para repositórios/serviços que permitam substituição transparente.
- Interface Segregation: crie interfaces pequenas e focadas (ex.: `UserRepository` com métodos necessários).
- Dependency Inversion: dependa de abstrações; injete implementações de repositórios em serviços.

## DDD (Domínio)

- Modele o domínio em `src/domain/` (entities, value objects, agregados e regras).
- Serviços de aplicação orquestram casos de uso; serviços de domínio contêm lógica invariantes.
- Repositórios representam agregados; persistência é detalhe (infra) injetado.
- Use value objects para validar e encapsular dados (ex.: Email, UUID, Slug).
- Mantenha linguagem ubíqua nos nomes: entidades, métodos e eventos usando termos do negócio.

## Performance e Produção

- Build: `npm run build` usa `esbuild` com `--external` para libs de terceiros.
- Start: `NODE_ENV=production` e `node dist/index.js` via `npm run start`.
- Evite transpilar em runtime em produção; não use `ts-node-dev` fora do dev.
- Ative compressão HTTP somente se necessário (por trás de proxies pode ser redundante).

## Convenções de Código

- Use TypeScript estrito; não utilizar `any` sem necessidade.
- Padronize respostas e erros; documente contratos de controllers e serviços.
- Mantenha nomes descritivos e coesos. Evite lógica acoplada a frameworks no domínio.
- Escreva testes unitários para serviços e domínio; teste integração para controllers.