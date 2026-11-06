# Situação atual (atualize no fim de cada sessão)

Última atualização: 05/11/2026 à noite (Mac de casa).

## Feito
- 8.0 a 8.9 implementados, com `npm run verify` código 0 e verifier em cada épico.
- 8.6 Gerenciar/cancelar/remarcar e 8.7 Reuniões do dono, com as correções dos verifiers.
- 8.8 Conta: nome, endereço, mensagem, fuso, reconectar, faixa de reconexão, excluir conta.
- 8.9 Faxina diária (`/api/cron/diario` + `vercel.json`), página Privacidade (`/privacidade?de={slug}`, link no rodapé das páginas públicas), `DOCUMENTACAO-TECNICA.md`, README com Resend e Vercel.
- Teste real ponta a ponta (Gmail + Outlook): marcar, reenviar e-mail com link novo, remarcar, cancelar.
- **No ar em https://reuniao.app.br** (Vercel, projeto `minha-agenda`, banco remoto compartilhado). Conta `alexandre@dablab.com.br` com o endereço `alexandre` e os 5 tipos do Calendly (gravados por SQL, mesma lógica do seed). Reserva real testada em produção (convidado Outlook): Meet, confirmação e aviso ao dono chegaram.
- Conta da BBZ: quando entrar com `asq@bbz.com.br`, trocar o endereço para `alexandrebbz` (tela Conta).

## Para o Alexandre decidir/fazer
1. Aprovar os textos marcados "a aprovar (8.6)", "(8.7)", "(8.8)" e "(8.9)" em `src/lib/copy.ts`.
2. Reserva remarcada: manter "O link novo está no e-mail de confirmação." (e emendar o spec) ou guardar o token novo cifrado para mostrar o link?
3. Seção 12: emendar a tabela para registrar a volta `cancelada_* → confirmada` quando o Google falha no cancelamento?
4. Abrir o app para qualquer pessoa (pedido de 05/11): muda o spec (anti-escopo, `EMAILS_PERMITIDOS`) e exige a verificação do Google (aviso "app não verificado" e limite de 100 usuários; projeto Google Cloud próprio em vez do DabLab).
5. Confirmação ao convidado presa em `pendente` (raro: falha entre o Resend aceitar e o banco gravar) hoje não tem reenvio automático nem botão. Deixar assim ou mostrar o "Reenviar" também para `pendente`?
6. Registro: no commit aaab5d3 (correção do 8.9) mudei a preparação de um teste novo (`mockReset` → `mockClear` + `mockResolvedValueOnce`), sem tirar nenhuma checagem; o `mockReset` apagava a faxina real dos testes seguintes.
7. Critério 8.1 "token válido 8 dias depois": conferir em 12/11/2026.

## Ambientes
- O banco local de cada computador é independente (dados não sincronizam). No computador novo: entrar com Google uma vez e rodar `npm run seed:calendly -- <email> --slug alexandre`.
- Segredos só no `.env.local` de cada computador (nunca no git).
