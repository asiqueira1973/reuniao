# Minha Agenda

Agendamento pessoal (substituto do uso básico do Calendly). Especificação em `spec.md`; guia do agente em `CLAUDE.md`.

## Setup local
1. Node 22, Docker e Supabase CLI instalados.
2. `npm install`
3. `cp .env.example .env.local` e preencha (ver "Variáveis").
4. `supabase start` (portas 554xx) e `supabase migration up --local`.
5. `npm run dev` → http://localhost:3020

## Comandos
- `npm run verify`: typecheck → lint → testes (pgTAP local + Vitest) → build.
- `npm run seed:calendly -- <email> [--slug <slug>]`: grava os tipos de evento do Calendly numa conta existente.

## Variáveis
Ver `.env.example` e a seção 18 do spec. Gere os segredos com `openssl rand -base64 32` (`TOKEN_ENC_KEY`, `SESSION_SECRET`, `CRON_SECRET`).

## Google Cloud (roteiro de cliques, uma vez só)
Faça logado com a conta Google que vai **administrar** o app (pode ser o Gmail pessoal; o projeto serve para todas as contas, inclusive a da BBZ).
1. https://console.cloud.google.com → seletor de projetos → **Novo projeto** → nome `minha-agenda` → Criar.
2. **APIs e serviços → Biblioteca** → procure **Google Calendar API** → **Ativar**.
3. **Google Auth Platform → Branding** (ou "Tela de consentimento OAuth"): nome do app `Minha Agenda`, e-mail de suporte e e-mail de contato do desenvolvedor = o seu. Salvar.
4. **Público (Audience)**: tipo de usuário **Externo**. Depois clique em **Publicar app** e confirme: o status tem que ficar **"Em produção"**. Em "Teste", a conexão cai a cada 7 dias (risco 23.1). Não peça verificação: para uso pessoal não é necessária.
5. **Acesso a dados (Data Access) → Adicionar ou remover escopos**: marque `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` e cole manualmente `https://www.googleapis.com/auth/calendar.freebusy` e `https://www.googleapis.com/auth/calendar.events.owned` → Atualizar → Salvar.
6. **Clientes → Criar cliente** → tipo **Aplicativo da Web** → nome `minha-agenda-web` → **URIs de redirecionamento autorizados**:
   - `http://localhost:3020/api/auth/google/callback`
   - `https://reuniao.app.br/api/auth/google/callback`
   Criar.
7. Copie o **ID do cliente** e a **Chave secreta** para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env.local` (e depois nas variáveis da Vercel).

No primeiro login o Google mostra "O Google não verificou este app" → **Avançado** → **Acessar Minha Agenda (não seguro)** → marque as **duas** permissões de agenda. É esperado para app pessoal; só o dono vê essa tela.

No passo 3 (Branding), em **Domínios autorizados**, acrescente `reuniao.app.br`.

## Resend e Vercel
_A completar nos épicos 8.5 e 8.9._
