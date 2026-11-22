# Documentação técnica — Reunião (reuniao.app.br)

Gerada a partir do código implementado (épicos 8.0 a 8.9), conforme a seção 19 do `spec.md` (v0.4). Toda mudança de schema, rota ou lógica de tela atualiza este documento no mesmo commit.

Stack: Next.js 16 (App Router, Cache Components, `src/proxy.ts`), Supabase Postgres (projeto compartilhado, prefixo `ag_`), Vercel (cron 1×/dia), Google OAuth + Calendar API, Resend.

---

## 1. Modelo de dados em linguagem de negócio

Todas as tabelas ficam no schema `public` com prefixo `ag_`. O app acessa o banco **só pelo servidor**, com a service role (`src/server/db/`).

| Tabela | O que guarda |
|---|---|
| `ag_contas` | Uma conta por e-mail Google: nome de exibição, endereço público (`slug`), mensagem de boas-vindas, fuso, feriados ligados (`feriados_ativos`) e a lista de feriados desligados (`feriados_desligados`). Nasce no primeiro login. v0.5: `termos_aceitos_em` (aceite dos Termos e da Privacidade nas boas-vindas; nulo = boas-vindas pendentes) e `suspensa_em` (conta suspensa por abuso; nulo = ativa). |
| `ag_conexoes_google` | A conexão com o Google Agenda da conta: refresh token **cifrado** (AES-256-GCM), escopos concedidos e a situação. `aviso_reconectar_enviado` impede repetir o e-mail "Reconecte sua agenda". |
| `ag_tipos_evento` | Os tipos de reunião (ex.: "Reunião de 30 minutos"): duração, Meet, antecedência mínima, janela em dias, intervalos antes/depois, passo dos horários, visível na página, ativo, ordem. Exclusão é lógica (`excluido_em`). |
| `ag_horarios_semanais` | As faixas da semana (dia 0 = domingo … 6 = sábado, início e fim em múltiplos de 5 min). |
| `ag_excecoes_data` | Exceções por data: dia indisponível ou horário especial (com faixas próprias). |
| `ag_reservas` | Cada reunião marcada: tipo, início/fim, convidado (nome, e-mail em minúsculas, fuso, observação), situação, evento e Meet do Google, hash do token de gestão, motivo e data de cancelamento, ligação com a reserva de origem quando é remarcação, e a data da anonimização. Nunca são apagadas (só anonimizadas após 24 meses). |
| `ag_notificacoes` | Cada e-mail que o app precisa mandar: tipo, situação, tentativas (máx. 5), id do Resend e o erro curto. Uma por (reserva, tipo). |
| `ag_oauth_clientes` | (9.6, MCP) Cada assistente que se registrou pelo `/oauth/registrar`: nome que ele deu e os endereços de volta aceitos (1 a 5). |
| `ag_oauth_codigos` | (9.6) Códigos de autorização de 10 min: hash do código, cliente, conta, endereço de volta, desafio PKCE, uso e o token emitido. |
| `ag_mcp_tokens` | (9.6) Cada conexão de um assistente a uma conta: só o hash do token `reuniao_mcp_…`, prefixo, criação, último uso e `revogado_em` (Conta → Assistentes conectados). |

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
| `ag_fn_cria_codigo_oauth(…)` | (9.6) Grava o código de autorização (hash) com validade. Conta suspensa não recebe código. |
| `ag_fn_troca_codigo_oauth(…)` | (9.6) Troca o código por token numa transação: confere cliente, endereço de volta, PKCE e validade. Código já usado → revoga o token emitido com ele (proteção contra roubo do código). |

## 4. Mapa tela → rotas → tabelas

| Tela | Rotas | Tabelas |
|---|---|---|
| `/entrar` | `GET /api/auth/google` → Google → `GET /api/auth/google/callback` | `ag_contas`, `ag_conexoes_google` (+ faixas e tipo padrão na conta nova) |
| `/painel/tipos`, `/novo`, `/[id]` | `GET/POST /api/painel/tipos`, `PATCH/DELETE /api/painel/tipos/[id]`, `POST /api/painel/tipos/ordem` | `ag_tipos_evento` |
| `/painel/disponibilidade` | `PUT /api/painel/disponibilidade/semanal`, `PUT/DELETE …/datas`, `PUT …/feriados` | `ag_horarios_semanais`, `ag_excecoes_data`, `ag_contas` (feriados) |
| `/painel/reunioes`, `/[id]` | `GET /api/painel/reunioes`, `GET …/[id]`, `POST …/[id]/cancelar`, `POST /api/painel/notificacoes/[id]/reenviar` | `ag_reservas`, `ag_notificacoes` (+ Google, Resend) |
| (boas-vindas, no lugar do painel enquanto `termos_aceitos_em` é nulo) | `POST /api/painel/conta/boas-vindas` | `ag_contas` |
| `/painel/conta` | `GET/PATCH/DELETE /api/painel/conta`, `GET …/slug-disponivel` | `ag_contas`, `ag_conexoes_google` (+ revoke no Google) |
| `/{slug}` | — (Server Component) | `ag_contas`, `ag_tipos_evento` |
| `/{slug}/{tipo}` | `GET /api/disponibilidade`, `POST /api/reservas` | todas as de disponibilidade + `ag_reservas`, `ag_notificacoes` (+ Google freebusy/events, Resend) |
| `/{slug}/{tipo}/confirmado` | — (cookie curto `ag_confirmacao`) | `ag_reservas` |
| `/r/{token}`, `/r/{token}/remarcar` | `GET /api/reservas/gestao`, `POST …/cancelar`, `POST …/remarcar`, `GET /api/disponibilidade?remarcar=` | `ag_reservas`, `ag_notificacoes` (+ Google, Resend) |
| `/` (página inicial, v0.5) | — (com sessão, o proxy manda para `/painel/tipos`) | — |
| `/privacidade` (`?de={slug}` opcional) | — | `ag_contas` (nome e e-mail de contato do dono, só com `?de=`) |
| `/termos` | — | — |
| `/painel/conta` → Assistentes conectados (9.6) | `DELETE /api/painel/conta/assistentes/[id]` | `ag_mcp_tokens` |
| `/oauth/autorizar` (consentimento do MCP) | `POST /oauth/autorizar/decidir`, `POST /oauth/registrar`, `POST /oauth/token`, `GET /.well-known/oauth-authorization-server`, `GET /.well-known/oauth-protected-resource[/mcp]` | `ag_oauth_clientes`, `ag_oauth_codigos`, `ag_mcp_tokens` |
| (assistente de IA) | `POST /mcp` (Bearer `reuniao_mcp_…`) | todas as do painel, pelas mesmas funções do servidor |
| (cron) | `GET /api/cron/diario` (Bearer `CRON_SECRET`) | `ag_reservas`, `ag_notificacoes`; lê `ag_contas` e `ag_conexoes_google` (+ Google delete/patch, Resend) |

O `src/proxy.ts` protege `/painel/*` (sessão no cookie `ag_sessao`, renovada após 7 dias) e devolve 404 real para `/{slug}` e `/{slug}/{tipo}` inexistentes.

## 5. Lógica das ações principais

**Login (8.1; v0.5, 8.10).** Cadastro aberto: sem `EMAILS_PERMITIDOS`, qualquer conta Google entra; `EMAILS_BLOQUEADOS` barra e-mails; conta **nova** acima de `CONTAS_NOVAS_POR_DIA` (padrão 50) nas últimas 24 h vê `erro=cadastros_pausados`. `state` aleatório em cookie de 10 min; troca o `code`, valida o `id_token`, exige os dois escopos de agenda e um refresh token, e o e-mail em `EMAILS_PERMITIDOS`. Conta nova: slug da parte local do e-mail (com `-2`, `-3`… se ocupado), 10 faixas seg–sex 10:30–12:00 e 14:30–18:00, tipo "Reunião de 30 minutos" e 4 feriados desligados. Login de novo: troca o token e volta a conexão para `ativa` (é o "Reconectar"). Erros voltam a `/entrar?erro=sem_acesso|escopos|falha`.

**Horários livres (8.4).** `computeSlots` (puro, `src/features/availability/compute.ts`) cruza faixas da semana (ou exceção da data), feriados ativos, antecedência, janela, passo, intervalos e os ocupados (freebusy do Google + reservas ativas). Google fora ou conexão revogada → nenhum horário e a mensagem da seção 15 (nunca oferece horário sem consultar o Google). Pedido limitado a 42 dias.

**Marcar (8.5).** `createBooking`: valida o horário de novo no servidor, aplica o limite por e-mail, grava `processando` (a constraint de sobreposição barra corrida → "Esse horário acabou de ser reservado."), cria o evento no Google com id previsível (`ag` + uuid) e Meet, passa a `confirmada` e manda os dois e-mails antes de responder (falha de e-mail não desfaz a reserva: fica `falhou` em `ag_notificacoes` para reenvio). Falha do Google → `falhou` e "Não consegui criar a reunião. Nada foi marcado.". Honeypot recusa robôs.

**Gerenciar pelo convidado (8.6).** O link `/r/{token}` vale pelo SHA-256 do token. Cancelar: toma a reserva no banco (condicional, para não correr com remarcação), apaga o evento (`sendUpdates=all`); Google com erro → volta a `confirmada` e 503. Remarcar: `ag_fn_remarcar_reservar` → patch do mesmo evento → confirma; falha → `ag_fn_desfaz_remarcacao`. Mesmo horário → 422.

**Reuniões do dono (8.7).** Abas Próximas/Passadas/Canceladas (50 por página, desempate por id). Cancelar com motivo (mesma ordem segura do convidado) e e-mail ao convidado com link para marcar de novo. Reenviar e-mail: o que não está `enviada` e tem < 5 tentativas (o botão aparece só para `falhou`); confirmação e aviso de reserva nova só de reunião confirmada; a confirmação ao convidado sai com link novo (o Google é atualizado antes de gravar o token novo); os demais são remontados sem mexer no token.

**Conta (8.8).** Nome, endereço (checagem ao digitar, confirmação "Links antigos deixam de funcionar. Continuar?"; os links `/r/` não dependem do slug), mensagem, fuso (só nomes IANA). Faixa laranja no painel quando a conexão está revogada. Excluir: digitar o endereço → revoga o token no Google → apaga a conta em cascata → apaga o cookie. Eventos já criados no Google ficam.

**Boas-vindas e suspensão (v0.5, 8.11 e 8.13).** O layout do painel mostra as boas-vindas enquanto não houver aceite. Elas têm saída (B-02): "Sair" (POST /sair) e "Não quero usar o Reunião", que exclui a conta pela mesma rota da tela Conta. Conta com `suspensa_em`: `getAccountById` devolve null (sessão não vale), `getPublicAccount`/`publicPathExists` a ignoram (404, sem horários nem reservas) e o login recusa com `erro=suspensa`. Suspender: `update ag_contas set suspensa_em = now() where slug = '…'`; reativar: `= null`.

**Faxina diária (8.9).** `src/server/cron.ts`, 09:00 UTC: (1) `processando` há mais de 10 min → `falhou`, apagando o evento que possa ter sido criado (remarcação presa só vai para o log `remarcacao_presa`); (2) reenvia `falhou` e `pendente` antigos com < 5 tentativas de reuniões que não terminaram, com as mesmas regras do botão Reenviar (confirmação `pendente` nunca: o e-mail pode ter saído e o reenvio troca o token; uma tentativa por e-mail por rodada); (3) anonimiza reservas com fim há mais de 24 meses. O que já saiu nunca é reenviado. Nos testes, a faxina roda só nas contas de teste (`contaIds`).

**MCP (9.6).** `https://reuniao.app.br/mcp`, Streamable HTTP sem estado (`@modelcontextprotocol/server` 2.4 + `ext-apps` 2.0). O assistente descobre o OAuth pelos metadados, registra-se sozinho, manda a pessoa a `/oauth/autorizar` (sem sessão → `/entrar?volta=…` → volta), recebe o código e troca por token com PKCE S256. O token vale até ser revogado; conta suspensa ou token revogado → 401. Cada requisição monta um `McpServer` com a conta do token (nenhuma ferramenta recebe conta por argumento). 21 ferramentas: 8 de leitura, 6 `abrir_formulario_*` (MCP Apps: um único HTML genérico `ui://reuniao/formulario-<hash>.html`, gerado por `scripts/build-mcp-ui.mjs`, que desenha os campos do `structuredContent` e grava chamando a ferramenta de salvar) e 7 de escrita (`salvar_*`, `marcar_reuniao`, `cancelar_reuniao`, `reenviar_email`), que validam com os mesmos schemas e gravam pelas mesmas funções do painel e devolvem erros por campo. Do Google, só horários livres. Eventos `reuniao_mcp_conectado` e `reuniao_mcp_ferramenta`.

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
- Faxina: remarcação presa em `processando` não é desfeita automaticamente (estado do Google incerto); fica no log `remarcacao_presa` todo dia e ocupa o horário novo até alguém resolver. **Decisão pendente.**
- Faxina e idempotência: o que deu certo nunca é reenviado, mas um e-mail que falhar de novo seria tentado outra vez numa segunda rodada imediata (até 5); com o cron 1×/dia isso não acontece. Evitar de vez exigiria uma coluna de última tentativa (migration).
- Anonimização: nome, e-mail e observação também ficam na descrição do evento no Google Agenda do dono, que o app não anonimiza (o texto de Privacidade avisa).
- Página de privacidade em `/privacidade?de={slug}` (o spec não fixa a URL).
- `DELETE /api/painel/conta` devolve `{ ok: true }`.
- MCP (9.6) não está no spec; desenho e regras em `plans/9.6-mcp.md`. Textos `oauth` e `assistants` do `copy.ts` "a aprovar".
- Textos fora da seção 15 marcados "a aprovar (8.6/8.7/8.8/8.9)" em `src/lib/copy.ts`.
