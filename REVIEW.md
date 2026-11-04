# Instruções de revisão

## Passes
Faça três passes e marque cada achado com o passe:
- Bugs: fuso (conta × convidado × UTC do servidor), bordas da regra 11.2 (encostar não é cruzar, faixa que não emenda), corrida de reserva, transições proibidas da seção 12, remarcação que perde a reserva original.
- Segurança: matriz da seção 5; requireConta()/requireReservaPorToken() na primeira linha; toda consulta com conta_id ou token_hash (service role ignora RLS); segredos só em src/server/; token e dados do convidado fora de log; Origin conferido nas escritas do painel.
- Conformidade: spec.md (épicos 8, regras 11 sem número inventado, copy da seção 15 em src/lib/copy.ts), plano em plans/, convenções da seção 18 — banco em português snake_case com prefixo ag_, rotinas comentadas com a regra que implementam.

## O que é Importante
Importante é o que marca reunião em cima de compromisso, deixa de avisar alguém, vaza dado de convidado ou viola regra do spec. Estilo e nome são detalhe.

## Limite de detalhes
No máximo cinco detalhes por revisão; resuma o resto como contagem.

## Não reportar
Arquivos gerados (src/server/db/types.ts, supabase/schema.sql) e o que o lint/CI já garante.
