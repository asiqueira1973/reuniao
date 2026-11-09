# B-03 — Google não consegue ler a página inicial e a privacidade

Registrado em 09/11/2026. A revisão do OAuth do Google (e-mail de 08/11) respondeu que https://reuniao.app.br e https://reuniao.app.br/privacidade estão "unresponsive". Para pessoas, as duas abrem normalmente (200, < 0,3 s, inclusive com o user-agent do Googlebot).

## Causa
- O layout raiz põe `<meta name="robots" content="noindex, nofollow">` em **todas** as páginas (assunção 24.8, de quando o app era só pessoal). Para robôs, a página inicial e a política "não existem".
- `/robots.txt` não existe: o proxy pula caminhos com ponto e o Next responde 200 com o HTML de "Página não encontrada", em vez de um arquivo de texto.

## Correção
- `/`, `/privacidade` e `/termos` passam a ter `index, follow` (metadata da página sobrepõe o padrão do layout, que continua `noindex` para painel, entrar, páginas de agenda e `/r/*`).
- `src/app/robots.ts`: libera tudo, menos `/painel`, `/r/` e `/api/`.
- Spec: emenda da assunção 24.8 (v0.5).

## Teste
`src/app/seo.test.ts`: metadata das três páginas com `index: true`; `robots()` com as regras acima. Antes: falha (as páginas não exportam metadata e não há robots.ts).
