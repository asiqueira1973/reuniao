# B-01 — Lista do painel não mostra o que acabou de ser salvo

Registrado em 05/11/2026 pelo Alexandre (produção): "quando eu crio um tipo novo, ele não dá refresh na lista e o novo não aparece".

## Reprodução
Build de produção local (`next build && next start`, porta 3020), conta `alexandre` do banco local:
1. `/painel/tipos` (5 tipos) → "Novo tipo" → nome "Teste Bug Lista" → Salvar.
2. Volta para `/painel/tipos` com os mesmos 5 tipos; o banco já tem o sexto (`ordem 5`).
Em `next dev` não acontece (por isso os testes e as conferências do 8.2 não pegaram).

## Causa
Os componentes de cliente do painel copiam os dados do servidor para o estado (`useState(initial)`). O Next 16 com Cache Components guarda as páginas já visitadas com o estado intacto: ao voltar para `/painel/tipos`, a instância antiga da lista reaparece e o `useState` ignora o `initial` novo que veio do servidor. O mesmo explica o "só 1 tipo" visto em produção depois do seed por SQL.
Tentativas descartadas (sem efeito no roteiro): Server Action com `revalidatePath("/painel", "layout")` e `await connection()` nas páginas.

## Correção
Padrão do React "ajustar estado quando a prop muda": cada componente guarda o `initial` recebido e, quando chega um novo, refaz o estado a partir dele. Aplicado em `event-type-list`, `weekly-editor`, `holidays-editor` e `account-form`.

## Teste
Não há teste automatizado do roteador no cliente (o Vitest roda no Node). Prova: o roteiro acima no build de produção local. Antes: o tipo novo não aparece (3 tentativas). Depois: "Teste Bug Quatro" aparece logo após salvar. Tipos de teste apagados do banco local depois.
