# B-01 — Lista do painel não mostra o que acabou de ser salvo

Registrado em 05/11/2026 pelo Alexandre (produção): "quando eu crio um tipo novo, ele não dá refresh na lista e o novo não aparece".

## Reprodução
Build de produção local (`next build && next start`, porta 3020), conta `alexandre` do banco local:
1. `/painel/tipos` (5 tipos) → "Novo tipo" → nome "Teste Bug Lista" → Salvar.
2. Volta para `/painel/tipos` com os mesmos 5 tipos; o banco já tem o sexto (`ordem 5`).
Em `next dev` não acontece (por isso os testes e as conferências do 8.2 não pegaram).

## Causa
`partialPrefetching` (Next 16): a página do painel lê o cookie de sessão, então o App Shell guardado no navegador já traz a lista. Depois de gravar por Route Handler, o formulário faz `router.push("/painel/tipos")` + `router.refresh()`, mas o `refresh()` só limpa o cache da rota **atual** (`/novo`), e o push reaproveita a lista antiga. Route Handler não invalida o cache do cliente; só Server Action invalida.

## Correção
Server Action `refreshPanel()` (`src/app/painel/actions.ts`), que confere a sessão e chama `revalidatePath("/painel", "layout")`. Todas as telas do painel a chamam depois de gravar, no lugar do `router.refresh()`, e antes de navegar.

## Teste
Não há teste automatizado de cache do roteador no cliente (Vitest roda no Node). Prova: o roteiro acima no build de produção local, antes e depois. Teste de unidade da action: sem sessão não invalida nada.
