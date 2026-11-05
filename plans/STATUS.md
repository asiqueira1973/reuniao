# Situação atual (atualize no fim de cada sessão)

Última atualização: 05/11/2026 (Mac de casa).

## Feito
- 8.0 Guardrails · 8.1 Banco + login Google · 8.2 Tipos de evento (+ seed Calendly) · 8.3 Disponibilidade · 8.4 Motor · 8.5 Página pública e reserva.
- Domínio `reuniao.app.br` verificado no Resend; remetente `agenda@reuniao.app.br`.
- Textos "a aprovar" de 8.2, 8.3 e 8.5 aprovados pelo Alexandre.

## Próximo
- **8.6 Gerenciar, cancelar e remarcar** (`/r/{token}`): ver `spec.md` 8.6 e seção 12. Começar pelo plano em `plans/8.6-gestao-convidado.md` (plan mode, aprovação).
- Depois: 8.7 Reuniões do dono, 8.8 Conta, 8.9 Faxina + deploy na Vercel + documentação.

## Pendências de teste real (precisam do Google/Resend de verdade)
- Reserva de teste real no Gmail do Alexandre: ter 10/11/2026 14:30, "Reunião de 1h", convidado `alexandre.siqueira@outlook.com` (banco local do Mac de casa). Cancelar pelo app no fim do 8.6 e conferir o cancelamento no Outlook.
- Critério 8.1 "token válido 8 dias depois": conferir em 12/11/2026.

## Ambientes
- O banco local de cada computador é independente (dados não sincronizam). No computador novo: entrar com Google uma vez e rodar `npm run seed:calendly -- <email> --slug alexandre`.
- Segredos só no `.env.local` de cada computador (nunca no git).
