# Documentação técnica — Reunião (reuniao.app.br)

Gerada a partir do código implementado (épicos 8.0 a 8.9), conforme a seção 19 do `spec.md` (v0.4). Toda mudança de schema, rota ou lógica de tela atualiza este documento no mesmo commit.

Stack: Next.js 16 (App Router, Cache Components, `src/proxy.ts`), Supabase Postgres (projeto compartilhado, prefixo `ag_`), Vercel (cron 1×/dia), Google OAuth + Calendar API, Resend.

---

## 1. Modelo de dados em linguagem de negócio

Todas as tabelas ficam no schema `public` com prefixo `ag_`. O app acessa o banco **só pelo servidor**, com a service role (`src/server/db/`).

| Tabela | O que guarda |
|---|---|
| `ag_contas` | Uma conta por e-mail Google: nome de exibição, endereço público (`slug`), mensagem de boas-vindas, fuso, feriados ligados (`feriados_ativos`) e a lista de feriados desligados (`feriados_desligados`). Nasce no primeiro login. |
| `ag_conexoes_google` | A conexão com o Google Agenda da conta: refresh token **cifrado** (AES-256-GCM), escopos concedidos e a situação. `aviso_reconectar_enviado` impede repetir o e-mail "Reconecte sua agenda". |
| `ag_tipos_evento` | Os tipos de reunião (ex.: "Reunião de 30 minutos"): duração, Meet, antecedência mínima, janela em dias, intervalos antes/depois, passo dos horários, visível na página, ativo, ordem. Exclusão é lógica (`excluido_em`). |
| `ag_horarios_semanais` | As faixas da semana (dia 0 = domingo … 6 = sábado, início e fim em múltiplos de 5 min). |
| `ag_excecoes_data` | Exceções por data: dia indisponível ou horário especial (com faixas próprias). |
| `ag_reservas` | Cada reunião marcada: tipo, início/fim, convidado (nome, e-mail em minúsculas, fuso, observação), situação, evento e Meet do Google, hash do token de gestão, motivo e data de cancelamento, ligação com a reserva de origem quando é remarcação, e a data da anonimização. Nunca são apagadas (só anonimizadas após 24 meses). |
| `ag_notificacoes` | Cada e-mail que o app precisa mandar: tipo, situação, tentativas (máx. 5), id do Resend e o erro curto. Uma por (reserva, tipo). |

Enums:

| Enum | Valores | Significado |
|---|---|---|
| `ag_status_conexao` | `ativa`, `revogada` | `revogada` quando o Google responde `invalid_grant`; volta a `ativa` ao reconectar. |
| `ag_status_reserva` | `processando`, `confirmada`, `cancelada_convidado`, `cancelada_dono`, `remarcada`, `falhou` | Máquina de estado da seção 12 (ver item 5). `processando` e `confirmada` ocupam o horário. |
| `ag_tipo_excecao` | `indisponivel`, `horario_especial` | Data sem horários, ou com faixas próprias no lugar das semanais. |
| `ag_status_notificacao` | `pendente`, `enviada`, `falhou` | `pendente` só durante o envio; a faxina reenvia os `pendente` com mais de 10 min. |
| `ag_tipo_notificacao` | `confirmacao_convidado`, `aviso_dono_nova`, `aviso_dono_remarcada`, `aviso_dono_cancelada`, `cancelamento_convidado`, `reconectar_google` | Os seis e-mails da seção 15. |

## 2. Relacionamentos

- Uma conta tem **no máximo uma** conexão Google (`ag_conexoes_google.conta_id` é a chave primária).
- Uma conta tem **vários** tipos de evento, faixas semanais, exceções de data, reservas e notificações. Excluir a conta apaga tudo isso em cascata.
- Um tipo de evento tem **várias** reservas; um tipo com reservas não pode ser apagado fisicamente (`ON DELETE RESTRICT`), por isso a exclusão no painel é lógica.
- Uma reserva remarcada aponta para **uma** reserva de origem (`remarcada_de_id`); a cadeia forma o histórico mostrado no detalhe da reunião.
- Uma reserva tem **no máximo uma** notificação de cada tipo (`ag_notificacoes_uk`). O aviso de reconexão é a única notificação sem reserva.

## 3. Triggers, funções, constraints e RLS

**Segurança:** RLS ligado em todas as `ag_*` e **nenhuma política**: `anon` e `authenticated` não leem nem gravam nada (`REVOKE ALL`). Só a `service_role` (servidor) acessa, e os helpers de `src/server/db/` sempre filtram por `conta_id` ou `token_hash`. Funções com `search_path = ''`, `security invoker`, executáveis só pela `service_role`.

| Objeto | O que faz |
|---|---|
| `ag_tg_atualizado_em` (trigger em contas, conexões, tipos, reservas) | Grava `now()` em `atualizado_em` a cada UPDATE. |
| `ag_fn_valida_faixas` (trigger em faixas semanais e exceções) | Recusa faixas sobrepostas no mesmo dia/data (erro `faixa_sobreposta`) e mistura de dia indisponível com horário especial (`excecao_conflitante`). Encostar (12:00–12:00) não é sobrepor. |
| `ag_fn_substitui_horarios(conta, faixas)` | Troca todas as faixas semanais da conta numa transação (PUT da tela Disponibilidade). |
| `ag_fn_substitui_excecoes_data(conta, data, tipo, faixas)` | Troca as exceções de uma data numa transação. |
| `ag_fn_remarcar_reservar(antiga, inicio, fim, token_hash, fuso)` | Passo 1 da remarcação: trava a antiga, confere que está confirmada e futura, muda para `remarcada` e cria a nova `processando` com o mesmo evento do Google. Horário tomado → `horario_indisponivel`, nada muda. |
| `ag_fn_desfaz_remarcacao(nova)` | Se o Google falhar na remarcação: nova → `falhou` e tenta devolver a antiga a `confirmada`; devolve `restaurada` ou `perdida` (alguém pegou o horário antigo; o dono é avisado). |
| `ag_reservas_sem_sobreposicao` (EXCLUDE gist, `btree_gist`) | Impede duas reservas `processando`/`confirmada` da mesma conta com horários que se cruzam (`[)`, encostar pode). É o que garante "nunca marcar em cima" mesmo com dois cliques simultâneos. |
| `ag_contas_slug_key`, `ag_contas_slug_ck`, `ag_contas_slug_reservado_ck` | Endereço único, no formato 3–30 `[a-z0-9-]` sem hífen nas pontas, fora da lista reservada (`painel`, `entrar`, `sair`, `api`, `r`, `privacidade`…). |
| `ag_tipos_evento_slug_uk` | Endereço do tipo único por conta entre os não excluídos. |
| Checks de `ag_tipos_evento` | Duração 15–240 múltipla de 5, antecedência 0–10080 min, janela 1–365 dias, intervalos 0–120, passo em {10,15,20,30,45,60,90,120}. |
| Checks de `ag_reservas` | E-mail em minúsculas, nome 1–100, observação ≤ 1000, motivo ≤ 500, fim > início. `ag_reservas_token_hash_key` torna o hash único. |
| Checks de `ag_notificacoes` | Tentativas 0–5; `reserva_id` nulo só em `reconectar_google`. |

## 4. Mapa tela → rotas → tabelas

| Tela | Rotas | Tabelas |
|---|---|---|
| `/entrar` | `GET /api/auth/google` → Google → `GET /api/auth/google/callback` | `ag_contas`, `ag_conexoes_google` (+ faixas e tipo padrão na conta nova) |
| `/painel/tipos`, `/novo`, `/[id]` | `GET/POST /api/painel/tipos`, `PATCH/DELETE /api/painel/tipos/[id]`, `PUT /api/painel/tipos/ordem` | `ag_tipos_evento` |
| `/painel/disponibilidade` | `PUT /api/painel/disponibilidade/semanal`, `PUT/DELETE …/datas`, `PUT …/feriados` | `ag_horarios_semanais`, `ag_excecoes_data`, `ag_contas` (feriados) |
| `/painel/reunioes`, `/[id]` | `GET /api/painel/reunioes`, `GET …/[id]`, `POST …/[id]/cancelar`, `POST /api/painel/notificacoes/[id]/reenviar` | `ag_reservas`, `ag_notificacoes` (+ Google, Resend) |
| `/painel/conta` | `GET/PATCH/DELETE /api/painel/conta`, `GET …/slug-disponivel` | `ag_contas`, `ag_conexoes_google` (+ revoke no Google) |
| `/{slug}` | — (Server Component) | `ag_contas`, `ag_tipos_evento` |
| `/{slug}/{tipo}` | `GET /api/disponibilidade`, `POST /api/reservas` | todas as de disponibilidade + `ag_reservas`, `ag_notificacoes` (+ Google freebusy/events, Resend) |
| `/{slug}/{tipo}/confirmado` | — (cookie curto `ag_confirmacao`) | `ag_reservas` |
| `/r/{token}`, `/r/{token}/remarcar` | `GET /api/reservas/gestao`, `POST …/cancelar`, `POST …/remarcar`, `GET /api/disponibilidade?remarcar=` | `ag_reservas`, `ag_notificacoes` (+ Google, Resend) |
| `/privacidade?de={slug}` | — | `ag_contas` (nome e e-mail de contato) |
| (cron) | `GET /api/cron/diario` (Bearer `CRON_SECRET`) | `ag_reservas`, `ag_notificacoes` |

O `src/proxy.ts` protege `/painel/*` (sessão no cookie `ag_sessao`, renovada após 7 dias) e devolve 404 real para `/{slug}` e `/{slug}/{tipo}` inexistentes.

## 5. Lógica das ações principais

**Login (8.1).** `state` aleatório em cookie de 10 min; troca o `code`, valida o `id_token`, exige os dois escopos de agenda e um refresh token, e o e-mail em `EMAILS_PERMITIDOS`. Conta nova: slug da parte local do e-mail (com `-2`, `-3`… se ocupado), 10 faixas seg–sex 10:30–12:00 e 14:30–18:00, tipo "Reunião de 30 minutos" e 4 feriados desligados. Login de novo: troca o token e volta a conexão para `ativa` (é o "Reconectar"). Erros voltam a `/entrar?erro=sem_acesso|escopos|falha`.

**Horários livres (8.4).** `computeSlots` (puro, `src/features/availability/compute.ts`) cruza faixas da semana (ou exceção da data), feriados ativos, antecedência, janela, passo, intervalos e os ocupados (freebusy do Google + reservas ativas). Google fora ou conexão revogada → nenhum horário e a mensagem da seção 15 (nunca oferece horário sem consultar o Google). Pedido limitado a 42 dias.

**Marcar (8.5).** `createBooking`: valida o horário de novo no servidor, aplica o limite por e-mail, grava `processando` (a constraint de sobreposição barra corrida → "Esse horário acabou de ser reservado."), cria o evento no Google com id previsível (`ag` + uuid) e Meet, passa a `confirmada` e manda os dois e-mails depois da resposta. Falha do Google → `falhou` e "Não consegui criar a reunião. Nada foi marcado.". Honeypot recusa robôs.

**Gerenciar pelo convidado (8.6).** O link `/r/{token}` vale pelo SHA-256 do token. Cancelar: toma a reserva no banco (condicional, para não correr com remarcação), apaga o evento (`sendUpdates=all`); Google com erro → volta a `confirmada` e 503. Remarcar: `ag_fn_remarcar_reservar` → patch do mesmo evento → confirma; falha → `ag_fn_desfaz_remarcacao`. Mesmo horário → 422.

**Reuniões do dono (8.7).** Abas Próximas/Passadas/Canceladas (50 por página, desempate por id). Cancelar com motivo (mesma ordem segura do convidado) e e-mail ao convidado com link para marcar de novo. Reenviar e-mail: só `falhou` com < 5 tentativas; a confirmação ao convidado sai com link novo (o Google é atualizado antes de gravar o token novo); os demais são remontados sem mexer no token.

**Conta (8.8).** Nome, endereço (checagem ao digitar, confirmação "Links antigos deixam de funcionar. Continuar?"; os links `/r/` não dependem do slug), mensagem, fuso (só nomes IANA). Faixa laranja no painel quando a conexão está revogada. Excluir: digitar o endereço → revoga o token no Google → apaga a conta em cascata → apaga o cookie. Eventos já criados no Google ficam.

**Faxina diária (8.9).** `src/server/cron.ts`, 09:00 UTC: (1) `processando` há mais de 10 min → `falhou`, apagando o evento que possa ter sido criado (remarcação presa só vai para o log `remarcacao_presa`); (2) reenvia `falhou` e `pendente` antigos com < 5 tentativas de reuniões que não terminaram, com as mesmas regras do botão Reenviar; (3) anonimiza reservas com fim há mais de 24 meses. Rodar duas vezes seguidas não manda e-mail duplicado.

**Logs.** Só códigos curtos e ids (`evento_sem_meet`, `reverter_cancelamento_falhou`, `revogacao_falhou`, `faxina_falhou`…). Nunca e-mail, nome, observação, token ou URL `/r/…` (seção 20).

## 6. Divergências em relação ao spec

Detalhe em `plans/8.*.md`, seção "Divergências". Resumo:

- `ag_fn_remarcar_reservar` tem um 5º parâmetro `p_fuso` (a reserva nova precisa do fuso).
- Ordem do enum `ag_tipo_notificacao` diferente do 7.2 (só estético).
- Checks e índices defensivos além da seção 7 (nome 1–100, dia 0–6, tentativas 0–5…).
- `/api/disponibilidade` devolve também 404 `tipo_indisponivel` e 422 `dados_invalidos`; pedido limitado a 42 dias.
- Paginação das reuniões por `?pagina=` em vez de cursor.
- Reserva remarcada mostra "O link novo está no e-mail de confirmação." em vez de link para a nova (o banco só guarda o hash). **Decisão pendente do Alexandre.**
- Cancelamento grava o estado no banco antes do Google e volta a `confirmada` se o Google falhar; a tabela da seção 12 não prevê essa volta. **Emenda pendente.**
- Durante a remarcação, o intervalo da própria reunião é tirado dos ocupados do freebusy (outro compromisso por cima dela não aparece como ocupado nesse momento).
- Faxina: remarcação presa em `processando` não é desfeita automaticamente (estado do Google incerto); fica no log.
- Página de privacidade em `/privacidade?de={slug}` (o spec não fixa a URL).
- `DELETE /api/painel/conta` devolve `{ ok: true }`.
- Textos fora da seção 15 marcados "a aprovar (8.6/8.7/8.8/8.9)" em `src/lib/copy.ts`.
