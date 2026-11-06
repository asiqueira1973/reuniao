# Reunião (reuniao.app.br)

Agendamento pessoal (substituto do uso básico do Calendly). Especificação em `spec.md`; guia do agente em `CLAUDE.md`.

## Setup local
1. Node 22, Docker e Supabase CLI instalados.
2. `npm install`
3. `cp .env.example .env.local` e preencha (ver "Variáveis").
4. `supabase start` (portas 554xx) e `supabase migration up --local`.
5. `npm run dev` → http://localhost:3020

## Comandos
- `npm run verify`: typecheck → lint → testes (pgTAP local + Vitest) → build.
- `npm run seed:calendly -- <email> [--slug <slug>]`: grava os 5 tipos de evento do Calendly numa conta existente (entre com o Google uma vez antes) e, com `--slug`, troca o endereço público. Pode rodar de novo sem duplicar.
- `npm run db:types`: regenera `src/server/db/types.ts` a partir do banco local.

## Variáveis
Ver `.env.example` e a seção 18 do spec. Gere os segredos com `openssl rand -base64 32` (`TOKEN_ENC_KEY`, `SESSION_SECRET`, `CRON_SECRET`).

## Cadastro aberto (spec v0.5)
- `EMAILS_PERMITIDOS` vazia ou ausente = qualquer conta Google cria agenda. Definida = só os da lista (útil em dev).
- `EMAILS_BLOQUEADOS`: e-mails barrados, separados por vírgula.
- `CONTAS_NOVAS_POR_DIA`: freio de cadastro (padrão 50 nas últimas 24 h).
- Suspender uma conta por abuso (SQL no Supabase): `update ag_contas set suspensa_em = now() where slug = 'fulano';` — reativar: `set suspensa_em = null`.
- Limite de reservas por IP (Vercel → Firewall → **Add Rule**): se `Request Path` igual a `/api/reservas` e `Method` igual a `POST`, então **Rate Limit**, 10 requisições por 60 s por IP, ação `Deny` (429).

## Google Cloud (roteiro de cliques, uma vez só)
Faça logado com a conta Google que vai **administrar** o app (pode ser o Gmail pessoal; o projeto serve para todas as contas, inclusive a da BBZ).
1. https://console.cloud.google.com → seletor de projetos → **Novo projeto** → nome `minha-agenda` → Criar.
2. **APIs e serviços → Biblioteca** → procure **Google Calendar API** → **Ativar**.
3. **Google Auth Platform → Branding** (ou "Tela de consentimento OAuth"): nome do app `Reunião`, e-mail de suporte e e-mail de contato do desenvolvedor = o seu. Salvar.
4. **Público (Audience)**: tipo de usuário **Externo**. Depois clique em **Publicar app** e confirme: o status tem que ficar **"Em produção"**. Em "Teste", a conexão cai a cada 7 dias (risco 23.1). Não peça verificação: para uso pessoal não é necessária.
5. **Acesso a dados (Data Access) → Adicionar ou remover escopos**: marque `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` e cole manualmente `https://www.googleapis.com/auth/calendar.freebusy` e `https://www.googleapis.com/auth/calendar.events.owned` → Atualizar → Salvar.
6. **Clientes → Criar cliente** → tipo **Aplicativo da Web** → nome `minha-agenda-web` → **URIs de redirecionamento autorizados**:
   - `http://localhost:3020/api/auth/google/callback`
   - `https://reuniao.app.br/api/auth/google/callback`
   Criar.
7. Copie o **ID do cliente** e a **Chave secreta** para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env.local` (e depois nas variáveis da Vercel).

No primeiro login o Google mostra "O Google não verificou este app" → **Avançado** → **Acessar Reunião (não seguro)** → marque as **duas** permissões de agenda. É esperado para app pessoal; só o dono vê essa tela.

No passo 3 (Branding), em **Domínios autorizados**, acrescente `reuniao.app.br`.

## Resend (e-mails)
1. https://resend.com → **Domains → Add domain** → `reuniao.app.br`.
2. No registro.br (DNS do domínio), crie os registros que o Resend mostrar: TXT de DKIM (`resend._domainkey`), MX e TXT de SPF em `send`, e um TXT `_dmarc` com `v=DMARC1; p=none;`. Não precisa ligar "Enable receiving".
3. Espere o Resend marcar **Verified** e crie uma **API key** (Sending access) → `RESEND_API_KEY`. Remetente: `EMAIL_REMETENTE=agenda@reuniao.app.br`.

## Deploy na Vercel
1. https://vercel.com → **Add New → Project** → importe `asiqueira1973/minha-agenda` (framework Next.js, sem mudar comandos).
2. **Settings → Environment Variables** (Production): copie do `.env.local` todas as variáveis de `.env.example`, trocando:
   - `NEXT_PUBLIC_SITE_URL=https://reuniao.app.br`
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do projeto remoto (Supabase → Project Settings → API).
   - `CRON_SECRET`: um segredo novo (`openssl rand -base64 32`); a Vercel manda `Authorization: Bearer <CRON_SECRET>` sozinha para o cron.
3. **Deploy**. Depois, **Settings → Domains** → `reuniao.app.br` e siga as instruções de DNS no registro.br (registro A `76.76.21.21` ou o que a Vercel indicar; `www` como CNAME).
   - **Importante:** o principal tem que ser `reuniao.app.br` (Production) e o `www` deve redirecionar (308) para ele. Se ficar ao contrário, toda gravação do painel falha com `origem_invalida` (a origem precisa ser igual a `NEXT_PUBLIC_SITE_URL`). Para inverter: primeiro tire o redirect do principal, depois ponha no `www`.
4. O cron vem do `vercel.json` (`/api/cron/diario`, todo dia 09:00 UTC = 06:00 de Brasília). Confira em **Settings → Cron Jobs**.
5. No Google Cloud (passo 6 acima), o redirect `https://reuniao.app.br/api/auth/google/callback` já precisa estar cadastrado.
6. Entre em `https://reuniao.app.br/entrar` com o Google (o banco remoto é outro: a conta nasce de novo) e rode o seed apontando para o remoto:
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed:calendly -- <email> --slug alexandre`

## Checklist de entrega (seção 26)
- [ ] Google Cloud em "Em produção", dois escopos de agenda, redirect de produção.
- [ ] Resend com domínio verificado (SPF/DKIM/DMARC).
- [ ] Vercel com domínio, variáveis e cron ativo.
- [ ] Login em produção, reserva de teste com outro e-mail, cancelamento pelo link.
- [ ] Documentação: `DOCUMENTACAO-TECNICA.md`, `CLAUDE.md`, este README.
