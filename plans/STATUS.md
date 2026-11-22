# Situação atual (atualize no fim de cada sessão)

Última atualização: 22/11/2026 (MCP, plano 9.6).

## Feito
- 8.0 a 8.9 implementados, com `npm run verify` código 0 e verifier em cada épico.
- 8.6 Gerenciar/cancelar/remarcar e 8.7 Reuniões do dono, com as correções dos verifiers.
- 8.8 Conta: nome, endereço, mensagem, fuso, reconectar, faixa de reconexão, excluir conta.
- 8.9 Faxina diária (`/api/cron/diario` + `vercel.json`), página Privacidade (`/privacidade?de={slug}`, link no rodapé das páginas públicas), `DOCUMENTACAO-TECNICA.md`, README com Resend e Vercel.
- Teste real ponta a ponta (Gmail + Outlook): marcar, reenviar e-mail com link novo, remarcar, cancelar.
- **No ar em https://reuniao.app.br** (Vercel, projeto `minha-agenda`, banco remoto compartilhado). Conta `alexandre@dablab.com.br` com o endereço `alexandre` e os 5 tipos do Calendly (gravados por SQL, mesma lógica do seed). Reserva real testada em produção (convidado Outlook): Meet, confirmação e aviso ao dono chegaram.
- **MCP (22/11/2026, plano 9.6):** `https://reuniao.app.br/mcp` com OAuth próprio, 21 ferramentas (leitura, formulários MCP Apps e gravação) e Conta → Assistentes conectados (desconectar). Privacidade ganhou a seção "Assistentes de IA (MCP)" (a aprovar).
- Conta da BBZ: quando entrar com `asq@bbz.com.br`, trocar o endereço para `alexandrebbz` (tela Conta).

## Para o Alexandre decidir/fazer
1. Aprovar os textos marcados "a aprovar (8.6)", "(8.7)", "(8.8)" e "(8.9)" em `src/lib/copy.ts`.
2. Reserva remarcada: manter "O link novo está no e-mail de confirmação." (e emendar o spec) ou guardar o token novo cifrado para mostrar o link?
3. Seção 12: emendar a tabela para registrar a volta `cancelada_* → confirmada` quando o Google falha no cancelamento?
4. Abrir o app para qualquer pessoa (pedido de 05/11): muda o spec (anti-escopo, `EMAILS_PERMITIDOS`) e exige a verificação do Google (aviso "app não verificado" e limite de 100 usuários; projeto Google Cloud próprio em vez do DabLab).
5. Confirmação ao convidado presa em `pendente` (raro: falha entre o Resend aceitar e o banco gravar) hoje não tem reenvio automático nem botão. Deixar assim ou mostrar o "Reenviar" também para `pendente`?
6. Registro: no commit aaab5d3 (correção do 8.9) mudei a preparação de um teste novo (`mockReset` → `mockClear` + `mockResolvedValueOnce`), sem tirar nenhuma checagem; o `mockReset` apagava a faxina real dos testes seguintes.
8. Aprovar os textos `oauth`, `assistants` e a seção de Privacidade "Assistentes de IA (MCP)" (a aprovar, 9.6).
7. Critério 8.1 "token válido 8 dias depois": conferir em 12/11/2026.

## Ambientes
- O banco local de cada computador é independente (dados não sincronizam). No computador novo: entrar com Google uma vez e rodar `npm run seed:calendly -- <email> --slug alexandre`.
- Segredos só no `.env.local` de cada computador (nunca no git).

## Verificação do Google (pausada em 05/11/2026 à noite)
Feito no projeto DabLab (dablab-473020): Branding preenchido (home dablab.com.br, privacidade e termos em reuniao.app.br), domínios autorizados só reuniao.app.br e dablab.com.br (os dois verificados no Search Console; não apagar os TXT do registro.br), Data Access com os escopos, a justificativa e o vídeo (https://youtu.be/YJKAcRU54UE). O site dablab.com.br ganhou rodapé "Legal" e o Reunião na página Apps.
Travado por um bug conhecido do console: "Your branding is not being shown to users" sem botão "Verify branding". Saída: tópico em https://discuss.google.dev (Cloud Foundations & Onboarding → OAuth App Verification) com o project ID, pedindo para publicar o branding.
Enquanto isso: o app funciona com o aviso "app não verificado" e o limite de 100 usuários do projeto. `EMAILS_PERMITIDOS` continua preenchida na Vercel (cadastro ainda restrito).
Atenção: os domínios dos outros apps (agendapsi, editoria, mentor1on1, supabase.co, flutterflow.app) saíram dos domínios autorizados; conferir se o login desses apps continua funcionando.

## Projeto Google novo (06/11/2026)
- O Reunião saiu do projeto DabLab (dablab-473020) e foi para um projeto próprio, **Reunião** (113158864946), na conta `alexandre@dablab.com.br`: Branding "Reunião", página inicial e privacidade em reuniao.app.br, Calendar API ativada, cliente Web com os redirects de produção e localhost. `GOOGLE_CLIENT_ID`/`SECRET` trocados no `.env.local` e na Vercel.
- Login e freebusy conferidos em local e produção (conta DabLab reconectada).
- BBZ (`asq@bbz.com.br`) reconectada no projeto novo; endereço fica `asq` (decisão do Alexandre). Conta do Gmail (`alexandre-silva-siqueira`) apagada por SQL em 06/11/2026 a pedido do Alexandre (sem reuniões).
- (histórico) Precisava entrar de novo: `alexandre.silva.siqueira@gmail.com` (slug `alexandre-silva-siqueira`, boas-vindas pendentes). Sem isso, a página delas fica "Agenda temporariamente indisponível".
- Projeto novo: Search Console (alexandre@dablab.com.br Owner de reuniao.app.br), Data Access (escopos e justificativa) e **Branding verificado em 06/11/2026** ("Reunião" já aparece no login). Vídeo novo (https://www.youtube.com/watch?v=2oBWUjSB-M8, 06/11) e **pedido de verificação enviado em 06/11/2026**: "Your app's data access is under review". Resposta por e-mail em alexandre@dablab.com.br.

## Bug B-02 (corrigido em 06/11/2026: "Sair" e "Não quero usar o Reunião" nas boas-vindas; ver plans/bugs/B-02)
A tela de boas-vindas não tem saída: sem aceitar os Termos, a pessoa não consegue sair nem excluir a conta (o painel inteiro fica escondido). Corrigir com "Sair" e "Não quero usar — excluir minha conta" nas boas-vindas. Achado em 06/11/2026 ao tentar apagar a conta do Gmail.

## Revisão do Google (09/11/2026)
- E-mail de 08/11 do Third-Party Data Safety Team: página inicial e privacidade "unresponsive" e vídeo sem as permissões abertas. No painel: Branding e "Request minimum scopes" aprovados; Homepage e Privacy policy com pendência; App functionality pendente.
- Causa das páginas: `noindex, nofollow` em todo o site e sem robots.txt (bug B-03, corrigido e no ar em 09/11).
- Vídeo novo: https://youtu.be/0H4Xp1D6FhI (09/11). Resposta enviada pelo Alexandre direto no e-mail do Google em 09/11. Próximo passo: aguardar o retorno em alexandre@dablab.com.br.
