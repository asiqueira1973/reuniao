@AGENTS.md

# CLAUDE.md — Reunião (repositório minha-agenda)

Fonte única de verdade: `spec.md` (v0.4). Planos aprovados: `plans/`. Princípios da seção 0 desempatam dúvidas; itens da seção 25 → **pare e pergunte**. O `DOCUMENTACAO-TECNICA.md` (a partir do fim da implementação) descreve o que está implementado; mudou schema, rota ou lógica de tela → atualize-o no mesmo commit, junto com este arquivo e o README quando couber.

## Regra de ouro
Se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.
Bug: teste que reproduz → ver falhar → commit → `touch .claude/fix-mode` → corrigir → `rm .claude/fix-mode`.

## Convenções (seção 18)
- Banco em português `snake_case`, **sempre com prefixo `ag_`** (projeto Supabase compartilhado `jeesdmfcrmhyufwzwzwt`). Código, variáveis e arquivos em inglês; fronteira em `src/server/db/`.
- Cabeçalho em português em toda função, rota, hook, trigger e função SQL: o que faz, recebe, devolve e a regra (ex.: `// Implementa a regra 11.2 (passo 5)`).
- Segredos só em `src/server/`, `src/app/api/`, `src/app/sair/` e `scripts/`. Todo arquivo de `src/server/` começa com `import "server-only"`.
- Copy só em `src/lib/copy.ts` (seção 15). Números só das regras da seção 11.
- Next.js 16 (App Router, Cache Components, `proxy.ts`): ler `node_modules/next/dist/docs/` antes de usar API nova.

## Arquitetura (seção 4)
Sem Supabase Auth: login = OAuth do Google próprio (`/api/auth/google`), que já conecta a agenda; sessão em cookie JWT (`jose`). Banco só pelo servidor (service role); RLS ligado **sem política** em todas as `ag_*`. Reserva: `POST /api/reservas` → revalida (11.3) → INSERT `processando` → Google `events.insert` com Meet → `confirmada` → Resend.

## Comandos (22.1)
`npm run typecheck` · `npm run lint` · `npm test` (pgTAP no Supabase local + Vitest) · `npm run build` · `npm run verify` (os quatro).
Saída saudável do verify: termina com a tabela de rotas do `next build`, código 0 (com testes: pgTAP "Result: PASS" e Vitest "Tests N passed").
`npm run dev` sobe em `http://localhost:3020`.

## Pegadinhas
- Supabase local usa as portas **554xx** (API 55421, DB 55422); 543xx e 553xx são de outros projetos. Stack enxuta (sem Studio/Mailpit/storage…) porque o Docker é dividido com outros dois Supabase; não desligue o `[auth]` (o Kong depende dele). Se as páginas travarem ou o Postgres cancelar por timeout (`57014`), confira `docker stats`: outros Supabase locais ligados sufocam o Docker; peça para pará-los.
- Remoto compartilhado: migrations via MCP `apply_migration` (mesmo SQL do arquivo), nunca `supabase db push`; advisors filtrados a `ag_*`; regenerar `supabase/schema.sql` no mesmo commit.
- Service role ignora RLS: toda consulta filtra por `conta_id` da sessão ou `token_hash` (seção 6).
- Rotas do painel: `requireConta()` na primeira linha; gestão do convidado: `requireReservaPorToken()`.
- Nunca oferecer horário se o Google falhar ou a conexão estiver `revogada` (princípio 2).
- `fim` da reserva é sempre calculado no servidor.
- Nunca logar e-mail, nome, observação, token ou URL `/r/…`.
- Tipos do banco: `npm run db:types` (põe `import "server-only"` no topo); nunca `supabase gen types` direto para o arquivo.
- Cache Components: cookies/sessão dentro de `<Suspense>`.
- `/sair` é POST (formulário); nunca `<Link href="/sair">`.
- Google Cloud precisa estar "Em produção" (em "Teste", o refresh token expira em 7 dias).
- `next dev` às vezes fica com módulo velho depois de muitas edições (erro mostra código antigo): reinicie o servidor antes de caçar bug.
- `copy.ts`: `  errors: {` aparece também dentro de `login`; ao inserir bloco por script, ancore num texto único (ex.: `errors: {\n    slug_em_uso`).
- Quando o agente errar a mesma coisa duas vezes, a correção entra aqui.
