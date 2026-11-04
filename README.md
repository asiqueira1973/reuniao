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

## Google Cloud (roteiro de cliques; detalhado no épico 8.1)
_A completar no épico 8.1._

## Resend e Vercel
_A completar nos épicos 8.5 e 8.9._
