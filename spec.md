# Reunião — Especificação (SDD)

| Campo | Valor |
|---|---|
| Versão | 0.5 (05/11/2026: app aberto para qualquer pessoa, produto DabLab, épicos 8.10–8.13; 0.4: nome Reunião; 0.3: domínio reuniao.app.br; 0.2: respostas da seção 25) |
| Responsável de produto | Alexandre Siqueira |
| Status | aprovado para implementação |
| Data | 03/11/2026 |
| Nome do produto | **Reunião** (domínio `reuniao.app.br`). "Minha Agenda" foi o nome de trabalho; continua só no nome da pasta e do repositório (`minha-agenda`) |

## Como usar este documento

É a fonte única de verdade do app de agendamento pessoal do Alexandre, que vai substituir o uso básico que ele faz hoje do Calendly. O Claude Code vai consumir este documento para implementar o app do zero.

**Antes de gerar qualquer código, revise a seção 24 (Assunções).** Assunção não revisada vira verdade no minuto em que o agente começa a codar. Itens da seção 25 (Perguntas abertas): o agente **para e pergunta**.

Referências citadas por número ("regra 11.3", "seção 7.3"); a numeração é estável.

**Projeto de referência:** `~/orcamento-casa` (Orçamento da Casa). Mesmo stack, mesmo projeto Supabase compartilhado, mesmas convenções, guardrails e loop de verificação, para reaproveitar o que já se sabe.

---

## 0. Princípios não-negociáveis

1. **Dois cliques para o convidado.** De abrir o link a ter a reunião marcada: escolher horário → preencher nome e e-mail → confirmar. Nenhuma conta, nenhum login, nenhum passo a mais para quem agenda.
2. **Nunca marcar em cima de compromisso.** Na dúvida (Google fora do ar, conexão revogada, corrida entre dois convidados), o horário **não** é oferecido. Errar recusando é aceitável; errar marcando por cima, não.
3. **O básico bem feito, sem recurso de Calendly pago.** Pagamentos, formulários de roteamento, equipes, enquetes e lembretes por SMS ficam fora. Se uma feature nova não serve ao uso pessoal do Alexandre, ela não entra.
4. **Configurar em uma tela por assunto.** Horários, feriados e datas específicas na mesma tela de Disponibilidade; um tipo de evento se edita numa tela só, com padrões que já funcionam.
5. **O Google é a agenda de verdade.** O evento vive no Google Agenda do dono, com Meet e convite oficial. O app guarda o mínimo para gerenciar a reserva.

---

## 1. Visão e problema

O Alexandre usa o Calendly só para ter um endereço público onde as pessoas reservam horário na agenda dele. O app cria o evento no Google Agenda com Google Meet, avisa por e-mail e deixa o convidado cancelar ou remarcar. Ele quer o próprio app, no mesmo espírito dos outros que já construiu (ViraPágina, Orçamento da Casa): visual limpo estilo Apple, fácil de configurar, fácil para o convidado.

Ele também quer **mais de uma conta**: uma com o Gmail pessoal (para testar primeiro) e outra com o e-mail da BBZ (`asq@bbz.com.br`), cada uma com endereço, tipos de evento e agenda próprios. Depois disso ele cancela o Calendly.

**Mudança v0.5 (05/11/2026):** o Reunião passa a ser um **produto gratuito da DabLab** (Alexandre da Silva de Siqueira LTDA - ME, CNPJ 61.033.268/0001-14, São Paulo/SP), aberto a qualquer pessoa com conta Google. Grátis para sempre, só em português.

**Anti-escopo:** não cobra de ninguém (nem do dono nem do convidado), não tem equipes nem agendamento coletivo, não cobra do convidado, não sincroniza Outlook ou iCloud e não é um app de calendário (a agenda é o Google).

---

## 2. Personas e cenários de uso

| Persona | Contexto | Momento mais difícil |
|---|---|---|
| **Dono** (Alexandre) | Configura uma vez pelo computador e depois só copia o link para mandar em e-mail ou WhatsApp. Às vezes cancela uma reunião pelo celular. | Mudar a disponibilidade de uma semana específica (viagem, feriado local) sem desconfigurar o resto. |
| **Convidado** (candidato de entrevista, cliente, síndico, parceiro) | Recebe o link, abre no celular, quase sempre com pressa. Não conhece o app nem tem conta. | Achar um horário que sirva e, dias depois, precisar remarcar sem ter que escrever para o Alexandre. |

---

## 3. Escopo do MVP

### Dentro
- Login do dono com Google, que já conecta a agenda (seção 6). Várias contas, cada uma com um e-mail Google.
- Endereço público por conta (`/{slug}`) com a lista de tipos de evento visíveis.
- Tipos de evento: nome, duração, descrição, Meet, antecedência mínima, janela de dias, intervalo entre reuniões, passo dos horários, visível ou oculto (o link continua funcionando), ativo.
- Disponibilidade semanal com várias faixas por dia; datas específicas (indisponível ou horário especial); feriados nacionais do Brasil com liga/desliga por feriado.
- Consulta à agenda principal do Google (livre/ocupado) para não oferecer horário ocupado.
- Reserva pelo convidado: calendário do mês, horários do dia no fuso do convidado, formulário (nome, e-mail, observação) e confirmação.
- Criação do evento no Google Agenda com Google Meet e o convidado como participante (convite oficial do Google).
- E-mails pelo Resend: confirmação para o convidado (com links de cancelar e remarcar); aviso para o dono em reserva nova, cancelamento e remarcação; aviso para o convidado quando o dono cancela.
- Página de gerenciamento da reserva pelo convidado (link secreto): ver, cancelar, remarcar.
- Painel do dono: Tipos de evento, Reuniões (próximas, passadas, canceladas, com cancelar), Disponibilidade, Conta (endereço, nome, mensagem de boas-vindas, conexão Google).
- Modo claro e escuro; pt-BR.

### Fora
| Item | Destino | Motivo / dependência |
|---|---|---|
| Lembrete por e-mail 24 h antes | v2 (seção 28) | O Google Agenda já lembra o convidado que aceitou o convite; avaliar depois de um mês de uso. |
| Consultar várias agendas (outras agendas Google, Outlook, iCloud) | v2 | Precisa de escopo `calendarlist` (sensível a mais) e tela de escolha. No MVP, só a agenda principal da conta conectada. |
| Sincronização de eventos apagados direto no Google | v2 | Exige push notifications do Google. No MVP, cancelar se faz pelo app (assunção 24.6). |
| Perguntas personalizadas no formulário | v2 | O campo "observação" livre cobre o uso atual. |
| Convidados adicionais na mesma reserva | v2 | Pouco uso; o dono pode adicionar direto no Google. |
| Interface em inglês | v2 | Convidado estrangeiro é raro hoje; a copy fica centralizada para facilitar (seção 18). |
| Limite de reuniões por dia/semana | v2 | Não usado no Calendly atual. |
| Zoom, Teams, telefone, presencial | descartado | Só Meet é usado. |
| Pagamento, roteamento, enquetes, equipes, links de uso único | descartado | Fora do uso pessoal (princípio 3). |
| App nativo | descartado | Web responsiva atende; o convidado abre link. |
| Captcha (Turnstile) | v2 | Só se aparecer abuso; MVP usa honeypot + limite por e-mail (regra 11.8). |

---

## 4. Arquitetura

| Camada | Escolha | Por quê | Alternativa descartada |
|---|---|---|---|
| Framework | **Next.js 16** (App Router, Cache Components, `proxy.ts`), React 19, TypeScript, mesma linha do `orcamento-casa` (16.4.x) | Reaproveita conhecimento e guardrails do projeto de referência | Remix / SvelteKit: stack novo sem ganho |
| Banco | **Supabase Postgres**, projeto compartilhado "BANCO DE TESTE" (`jeesdmfcrmhyufwzwzwt`), tabelas com **prefixo `ag_`** | Mesmo projeto dos outros apps, custo zero | Projeto Supabase próprio: mais um projeto para manter (plano de saída, se o compartilhado ficar apertado) |
| Acesso ao banco | **Só pelo servidor**, com service role, em `src/server/db/`. RLS **ligado sem nenhuma política** em todas as `ag_*` (nega tudo a `anon`/`authenticated`) | Não há Supabase Auth (ver linha abaixo); o banco nunca é tocado do navegador | Supabase Auth + RLS por `auth.uid()`: ver próxima linha |
| Autenticação do dono | **OAuth do Google próprio** (rota de servidor), com sessão em cookie `HttpOnly` assinado (JWT HS256 via `jose`) | Um único consentimento dá identidade **e** acesso à agenda. Ligar o provedor Google no Supabase Auth afetaria o projeto compartilhado inteiro e não devolve o refresh token de forma confiável | Supabase Auth com Google: mexe na Auth de todos os apps do projeto e exigiria segundo fluxo OAuth para a agenda |
| Agenda | **Google Calendar API v3**: `freebusy.query` (escopo `calendar.freebusy`, não sensível) e `events.insert/patch/delete` com `conferenceDataVersion=1` para criar o Meet (escopo `calendar.events.owned`, sensível) | Escopos mais estreitos que resolvem o caso | `calendar.events` (mais amplo, também sensível), `calendar` (restrito) |
| App OAuth no Google Cloud | Projeto próprio do Alexandre, tipo **Externo**, status de publicação **"Em produção"**, **sem verificação** (uso pessoal < 100 usuários) | No status "Teste", o refresh token expira em 7 dias; em produção não. Uso pessoal dispensa verificação, com a tela de "app não verificado" no consentimento (só o dono vê) | Status "Teste": desconecta toda semana. Verificação do Google: processo longo e desnecessário |
| E-mail | **Resend** (plano gratuito: 3.000/mês, 100/dia), remetente `agenda@{domínio}` | Já recomendado; volume baixíssimo; texto e links sob nosso controle | Gmail API: escopo `gmail.send` é restrito (auditoria). Só o convite do Google: sem links de cancelar/remarcar |
| Convite ao convidado | O próprio Google (`sendUpdates=all` no insert/patch/delete) | Convite oficial com Meet, entra na agenda do convidado | `.ics` anexado: duplica o convite do Google |
| Datas e fusos | `date-fns` v4 + `@date-fns/tz` | Cálculo de horários em fuso explícito, sem depender do fuso do servidor | `Date` puro: erro de fuso na Vercel (UTC) |
| Validação | `zod` 4 | Mesmo do projeto de referência | — |
| Hospedagem | **Vercel** (plano Hobby), domínio próprio (pergunta 25.1) | Mesma do projeto de referência; cron diário incluído | — |
| Cron | Vercel Cron **1×/dia** → `/api/cron/diario` (seção 13) | Hobby permite 1 execução diária; as tarefas são de faxina | Supabase `pg_cron`: lógica espalhada |
| Repositório | `~/minha-agenda`, GitHub privado `minha-agenda` | — | — |

**Premissas a validar no épico 8.1:** (a) o Workspace da BBZ permite que `asq@bbz.com.br` autorize um app não verificado (risco 23.2); (b) a extensão `btree_gist` está disponível no projeto compartilhado (necessária na constraint 7.3); (c) nenhum objeto com prefixo `ag_` existe no remoto.

Fluxo principal:

```
Convidado → /{slug}/{tipo}  ─GET /api/disponibilidade─▶ servidor ─freebusy─▶ Google
           escolhe horário ─POST /api/reservas───────▶ servidor: valida (11.2) → INSERT ag_reservas (processando)
                                                        → events.insert (Meet, sendUpdates=all) ─▶ Google
                                                        → UPDATE confirmada → Resend (convidado + dono)
```

---

## 5. Perfis de usuário e matriz de permissões

Dois perfis: **dono** (logado; dono de uma `ag_contas`) e **convidado** (anônimo; pode ter o token de uma reserva).

| Ação | Dono | Convidado |
|---|---|---|
| Criar conta | ✅ qualquer conta Google (v0.5), salvo e-mail em `EMAILS_BLOQUEADOS`, conta suspensa ou limite diário de contas novas atingido; se `EMAILS_PERMITIDOS` estiver definida (dev/testes), só os da lista | ❌ |
| Ver/editar tipos de evento, disponibilidade e dados da conta | ✅ **só da própria conta** | ❌ |
| Ver página pública e horários livres | ✅ | ✅ de qualquer conta ativa, só tipos `ativo`; tipos ocultos só pelo link direto |
| Ver detalhes de compromissos do Google | ❌ (o app só lê livre/ocupado) | ❌ (vê só horários livres, nunca o motivo de ocupado) |
| Criar reserva | ✅ (como convidado, pela página pública) | ✅ |
| Ver lista de reuniões | ✅ **só da própria conta** | ❌ |
| Ver uma reserva | ✅ das próprias | ✅ **só a do token que possui** |
| Cancelar reserva | ✅ das próprias, se `confirmada` e futura | ✅ **só a do token**, se `confirmada` e ainda não começou |
| Remarcar reserva | ❌ no MVP (o dono cancela e manda o link de novo) | ✅ **só a do token**, mesmas condições do cancelamento |
| Desconectar Google / excluir conta | ✅ só a própria | ❌ |

**Primeiro dono:** não há seed de usuário. A conta nasce no primeiro login (v0.5: qualquer e-mail Google; `EMAILS_PERMITIDOS`, se definida, restringe à lista). Na criação, o servidor grava a disponibilidade padrão e um tipo de evento padrão (regra 11.9).

O escopo de dados é sempre `conta_id`; toda rota do painel chama `requireConta()` na primeira linha e filtra por `conta_id` da sessão.

---

## 6. Autenticação e identidade

- **Identificador:** o e-mail da conta Google (`sub` do Google guardado como `google_sub`, chave estável; o e-mail pode mudar).
- **Entrar:** botão "Entrar com Google" em `/entrar` → `GET /api/auth/google` gera `state` (cookie curto, `HttpOnly`) e redireciona ao Google com `access_type=offline`, `prompt=consent`, escopos `openid email profile https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events.owned`.
- **Retorno:** `GET /api/auth/google/callback` confere o `state`, troca o código, valida o `id_token`, confere o acesso (v0.5, épico 8.10): e-mail em `EMAILS_BLOQUEADOS`, fora de `EMAILS_PERMITIDOS` quando ela está definida, ou conta suspensa → "Este e-mail não tem acesso." / "Esta conta está suspensa."; conta **nova** com o limite diário `CONTAS_NOVAS_POR_DIA` (padrão 50) atingido → "Cadastros pausados por hoje. Tente amanhã."; em todos esses casos não grava nada, confere que **os dois escopos de agenda foram concedidos** (o Google permite desmarcar; se faltar, mostra "Para funcionar, marque as duas permissões de agenda." e oferece tentar de novo), cria ou atualiza `ag_contas` e `ag_conexoes_google` (refresh token **cifrado**, regra 11.10) e abre a sessão.
- **Várias contas:** cada e-mail Google é uma conta separada. Para usar outra, o dono sai e entra com o outro e-mail (o botão do Google mostra o seletor de contas: `prompt=consent select_account`).
- **Sessão:** cookie `ag_sessao` com JWT HS256 (`SESSION_SECRET`), `HttpOnly`, `Secure`, `SameSite=Lax`, validade 30 dias, renovado a cada uso com mais de 7 dias. Conteúdo: `conta_id` e `iat`. `proxy.ts` redireciona `/painel/*` sem sessão para `/entrar`.
- **Sair:** `POST /sair` (formulário) apaga o cookie. Nunca `<Link href="/sair">`.
- **Recuperação de senha:** não existe senha. Se o Google revogar o acesso, o dono entra de novo com Google e a conexão é refeita.
- **Conexão revogada:** se o Google responder `invalid_grant`, o servidor marca `ag_conexoes_google.status = 'revogada'`, a página pública passa a mostrar "Agenda temporariamente indisponível." (nenhum horário oferecido, princípio 2) e o dono recebe **um** e-mail "Reconecte sua agenda" (sem repetir enquanto continuar revogada). No painel aparece uma faixa laranja "Reconectar Google".
- **Autorização no banco:** todas as tabelas `ag_*` com `ENABLE ROW LEVEL SECURITY` e **nenhuma política**. Sem `GRANT` para `anon`/`authenticated` (`REVOKE ALL`). O acesso é só via service role nas rotas de servidor, que aplicam a matriz da seção 5. Como a service role ignora RLS, **toda consulta do servidor filtra por `conta_id` da sessão ou pelo hash do token**; isso é garantido pelos helpers de `src/server/db/` (seção 18).
- **Convidado:** anônimo. O acesso a uma reserva é pelo token de gestão (regra 11.7): 32 bytes aleatórios em base64url no link; o banco guarda só o SHA-256.

---

## 7. Modelo de dados

Banco em português, `snake_case`, prefixo `ag_` (projeto compartilhado). Timestamps em `timestamptz` (UTC); horários de faixa em `time` interpretados no `fuso` da conta.

### 7.1 Diagrama

```
ag_contas 1 ──── 1 ag_conexoes_google
    │
    ├── 1 ──── N ag_tipos_evento 1 ──── N ag_reservas ──┐ remarcada_de_id (N:1, opcional)
    ├── 1 ──── N ag_horarios_semanais                   └─▶ ag_reservas
    ├── 1 ──── N ag_excecoes_data
    └── 1 ──── N ag_reservas 1 ──── N ag_notificacoes
```

### 7.2 Enums

| Enum | Valores | Significado |
|---|---|---|
| `ag_status_conexao` | `ativa`, `revogada` | Conexão Google funcionando; Google recusou o refresh token |
| `ag_status_reserva` | `processando`, `confirmada`, `cancelada_convidado`, `cancelada_dono`, `remarcada`, `falhou` | Ver máquina de estado, seção 12 |
| `ag_tipo_excecao` | `indisponivel`, `horario_especial` | Dia inteiro bloqueado; dia com faixas próprias no lugar das semanais |
| `ag_tipo_notificacao` | `confirmacao_convidado`, `aviso_dono_nova`, `aviso_dono_cancelada`, `aviso_dono_remarcada`, `cancelamento_convidado`, `reconectar_google` | Qual e-mail |
| `ag_status_notificacao` | `pendente`, `enviada`, `falhou` | Situação do envio pelo Resend |

### 7.3 Tabelas

**`ag_contas`**: uma por e-mail Google do dono.

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `google_sub` | text | não | — | unique; identificador estável do Google |
| `email` | text | não | — | e-mail Google; também recebe os avisos do dono |
| `nome_exibicao` | text | não | — | vem do Google na criação; editável. Ex.: "Alexandre Siqueira" |
| `slug` | text | não | — | unique; `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`; fora da lista reservada (regra 11.11) |
| `mensagem_boas_vindas` | text | sim | — | nulo = página pública sem mensagem. Máx. 300 caracteres |
| `fuso` | text | não | `'America/Sao_Paulo'` | fuso IANA da disponibilidade |
| `feriados_ativos` | boolean | não | `true` | chave geral dos feriados (regra 11.4) |
| `feriados_desligados` | text[] | não | `'{}'` | códigos (regra 11.4) desligados individualmente |
| `criado_em` | timestamptz | não | `now()` | |
| `atualizado_em` | timestamptz | não | `now()` | trigger `ag_tg_atualizado_em` |

**`ag_conexoes_google`**: segredo da conexão; nunca sai do servidor.

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `conta_id` | uuid | não | — | PK e FK → `ag_contas.id` on delete cascade |
| `refresh_token_cifrado` | text | não | — | AES-256-GCM, formato `iv.tag.cifra` em base64url (regra 11.10) |
| `escopos` | text[] | não | — | escopos concedidos |
| `status` | `ag_status_conexao` | não | `'ativa'` | |
| `revogada_em` | timestamptz | sim | — | nulo enquanto `ativa` |
| `aviso_reconectar_enviado` | boolean | não | `false` | evita repetir o e-mail de reconexão; volta a `false` ao reconectar |
| `atualizado_em` | timestamptz | não | `now()` | |

**`ag_tipos_evento`**

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `conta_id` | uuid | não | — | FK → `ag_contas.id` on delete cascade |
| `nome` | text | não | — | 1–60 caracteres |
| `slug` | text | não | — | mesmo formato do slug da conta; unique por (`conta_id`, `slug`) entre não excluídos |
| `descricao` | text | sim | — | nulo = sem descrição. Máx. 1.000 |
| `duracao_min` | integer | não | `30` | check 15–240 e múltiplo de 5 |
| `com_meet` | boolean | não | `true` | se falso, o evento é criado sem conferência |
| `antecedencia_min` | integer | não | `240` | minutos; check 0–10080 |
| `janela_dias` | integer | não | `60` | check 1–365 |
| `intervalo_antes_min` | integer | não | `0` | folga antes; check 0–120 |
| `intervalo_depois_min` | integer | não | `0` | folga depois; check 0–120 |
| `passo_min` | integer | não | `30` | de quanto em quanto os horários começam; check em (10, 15, 20, 30, 45, 60, 90, 120) |
| `visivel_na_pagina` | boolean | não | `true` | falso = some da página da conta, link direto continua valendo |
| `ativo` | boolean | não | `true` | falso = link mostra "Este tipo de reunião não está disponível." |
| `ordem` | integer | não | `0` | ordenação na página e no painel |
| `excluido_em` | timestamptz | sim | — | nulo = não excluído (soft delete, 7.4) |
| `criado_em` | timestamptz | não | `now()` | |
| `atualizado_em` | timestamptz | não | `now()` | |

Índice único parcial `ag_tipos_evento_slug_uk` em (`conta_id`, `slug`) `where excluido_em is null`.

**`ag_horarios_semanais`**: faixas recorrentes.

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `conta_id` | uuid | não | — | FK on delete cascade |
| `dia_semana` | smallint | não | — | 0 = domingo … 6 = sábado |
| `inicio` | time | não | — | múltiplo de 5 min |
| `fim` | time | não | — | check `fim > inicio` |

Sobreposição de faixas no mesmo dia: barrada pela função `ag_fn_valida_faixas` (7.5).

**`ag_excecoes_data`**: datas específicas.

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `conta_id` | uuid | não | — | FK on delete cascade |
| `data` | date | não | — | data no fuso da conta |
| `tipo` | `ag_tipo_excecao` | não | — | |
| `inicio` | time | sim | — | nulo se e só se `tipo = 'indisponivel'` |
| `fim` | time | sim | — | idem; check `fim > inicio` |

Check `ag_excecoes_data_tipo_ck`: (`tipo='indisponivel'` e `inicio`/`fim` nulos) ou (`tipo='horario_especial'` e ambos preenchidos). Um `indisponivel` não convive com `horario_especial` na mesma data (função 7.5).

**`ag_reservas`**

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `conta_id` | uuid | não | — | FK → `ag_contas.id` on delete cascade |
| `tipo_evento_id` | uuid | não | — | FK → `ag_tipos_evento.id` (restrict; tipo é só soft-deletado) |
| `inicio` | timestamptz | não | — | |
| `fim` | timestamptz | não | — | check `fim > inicio` |
| `nome_convidado` | text | não | — | 1–100 |
| `email_convidado` | text | não | — | minúsculo; formato e-mail |
| `observacao` | text | sim | — | nulo = convidado não escreveu nada. Máx. 1.000 |
| `fuso_convidado` | text | não | — | fuso IANA em que o convidado escolheu (para os e-mails) |
| `status` | `ag_status_reserva` | não | `'processando'` | seção 12 |
| `google_evento_id` | text | sim | — | nulo enquanto `processando` ou se `falhou` |
| `link_meet` | text | sim | — | nulo se `com_meet` falso ou antes de confirmar |
| `token_hash` | text | não | — | unique; SHA-256 hex do token de gestão |
| `remarcada_de_id` | uuid | sim | — | FK → `ag_reservas.id`; nulo = reserva original |
| `motivo_cancelamento` | text | sim | — | opcional, quem cancelou escreveu. Máx. 500 |
| `cancelada_em` | timestamptz | sim | — | nulo se não cancelada |
| `dados_anonimizados_em` | timestamptz | sim | — | nulo até a faxina de privacidade (regra 11.12) |
| `criado_em` | timestamptz | não | `now()` | |
| `atualizado_em` | timestamptz | não | `now()` | |

Constraint de não sobreposição (a garantia do princípio 2):
`ag_reservas_sem_sobreposicao EXCLUDE USING gist (conta_id WITH =, tstzrange(inicio, fim, '[)') WITH &&) WHERE (status IN ('processando','confirmada'))`. Requer `btree_gist`.
Índices: (`conta_id`, `inicio`), (`email_convidado`, `conta_id`), `token_hash` unique.

**`ag_notificacoes`**: registro de cada e-mail, para reenvio e idempotência.

| Coluna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `conta_id` | uuid | não | — | FK on delete cascade |
| `reserva_id` | uuid | sim | — | FK → `ag_reservas.id` on delete cascade; nulo só em `reconectar_google` |
| `tipo` | `ag_tipo_notificacao` | não | — | |
| `status` | `ag_status_notificacao` | não | `'pendente'` | |
| `tentativas` | smallint | não | `0` | máx. 5 (regra 11.6) |
| `resend_id` | text | sim | — | nulo até enviar |
| `erro` | text | sim | — | última mensagem de erro, sem dados pessoais |
| `criado_em` | timestamptz | não | `now()` | |
| `enviada_em` | timestamptz | sim | — | |

Unique `ag_notificacoes_uk` em (`reserva_id`, `tipo`): o mesmo e-mail nunca sai duas vezes para a mesma reserva.

### 7.4 Exclusão

| Entidade | Estratégia | Motivo |
|---|---|---|
| `ag_tipos_evento` | soft delete (`excluido_em`) | reservas antigas o referenciam |
| `ag_horarios_semanais`, `ag_excecoes_data` | hard delete | sem histórico |
| `ag_reservas` | nunca apagadas; anonimizadas após 24 meses (regra 11.12) | histórico de reuniões |
| `ag_contas` | hard delete pelo dono (cascata em tudo) | direito de exclusão (seção 20). Antes de apagar, o servidor revoga o token no Google |

### 7.5 Lógica no banco

| Nome | Tipo | Onde | O que faz |
|---|---|---|---|
| `ag_tg_atualizado_em` | trigger `BEFORE UPDATE` | todas as tabelas com `atualizado_em` | grava `now()` |
| `ag_fn_valida_faixas` | trigger `BEFORE INSERT/UPDATE` | `ag_horarios_semanais`, `ag_excecoes_data` | recusa faixa que se sobrepõe a outra do mesmo dia/data da mesma conta (`RAISE EXCEPTION 'faixa_sobreposta'`); em `ag_excecoes_data`, recusa misturar `indisponivel` e `horario_especial` na mesma data (`'excecao_conflitante'`) |
| `ag_fn_substitui_horarios` | função (`SECURITY INVOKER`, `search_path=''`) | — | recebe `conta_id` e um jsonb de faixas e troca todas as faixas semanais numa transação (a tela salva tudo de uma vez) |
| `ag_fn_substitui_excecoes_data` | função | — | idem para uma data: apaga as exceções da data e grava as novas |
| `ag_fn_remarcar_reservar` / `ag_fn_desfaz_remarcacao` | funções | `ag_reservas` | remarcação atômica e sua reversão (seção 12) |
| `ag_reservas_sem_sobreposicao` | exclusion constraint | `ag_reservas` | duas reservas ativas da mesma conta nunca se sobrepõem, mesmo com dois convidados clicando ao mesmo tempo |

Erros de negócio sobem com `MESSAGE` = código (`faixa_sobreposta`, `excecao_conflitante`); violação da exclusion constraint (SQLSTATE `23P01`) é traduzida pelo servidor para `horario_indisponivel`.

### 7.6 Seed e migrations

- Migrations em `supabase/migrations/`, aplicadas no remoto pelo MCP `apply_migration` com o mesmo SQL do arquivo (nunca `supabase db push` no projeto compartilhado). Migration versionada não se edita.
- Depois de aplicar: `get_advisors` (security + performance), filtrando objetos `ag_*`, e regenerar `supabase/schema.sql` filtrado ao prefixo `ag_` no mesmo commit.
- Primeira migration: `create extension if not exists btree_gist with schema extensions;` (se já existir, nada muda).
- Supabase local nas portas **554xx** (API 55421, DB 55422, Studio 55423, Mailpit 55424): 543xx e 553xx já estão em uso por outros projetos.
- Seed de conta: não há. A conta nasce no primeiro login (regra 11.9). O script opcional `npm run seed:calendly -- <email> [--slug <slug>]` grava na conta existente os tipos de evento atuais do Calendly (regra 11.9).

---

## 8. Épicos e critérios de aceite

### 8.0 Guardrails
Criar os arquivos do Anexo B, tornar os scripts executáveis e testar cada hook provocando a violação uma vez.
- [ ] Escrever `SUPABASE_SERVICE_ROLE_KEY` em `src/app/(publico)/x.tsx` é bloqueado com a mensagem do hook.
- [ ] Editar uma migration já commitada é bloqueado.
- [ ] Com `.claude/fix-mode` presente, editar `*.test.ts` é bloqueado.
- [ ] Escrever em `supabase/migrations/` dispara o lembrete de advisors.
- [ ] Escrever `GOOGLE_CLIENT_SECRET` ou `TOKEN_ENC_KEY` em componente de cliente é bloqueado.

### 8.1 Fundação: projeto, banco, login
Objetivo: o dono entra com Google e a conta nasce com padrões que já funcionam.

Fluxo: `/entrar` → Google (seletor de conta, consentimento, aviso de app não verificado) → callback → `/painel/tipos`.

- [ ] Migrations aplicadas local e remoto; advisors sem alerta crítico em `ag_*` (o aviso "RLS enabled no policy" é esperado e documentado, seção 6).
- [ ] `anon` e `authenticated` não conseguem `select` em nenhuma `ag_*` (teste pgTAP).
- [ ] E-mail fora de `EMAILS_PERMITIDOS` vê "Este e-mail não tem acesso." e nenhuma linha é criada.
- [ ] Consentimento sem um dos escopos de agenda mostra a mensagem da seção 6 e não cria a conta.
- [ ] Primeiro login cria `ag_contas` (slug sugerido pela regra 11.11), `ag_conexoes_google` com token cifrado (o texto no banco não contém `1//`), faixas padrão e o tipo padrão (regra 11.9).
- [ ] Segundo login com o mesmo Google atualiza o token e não duplica a conta.
- [ ] `/painel/*` sem cookie redireciona para `/entrar`; `POST /sair` apaga o cookie.
- [ ] Projeto Google Cloud em "Em produção" (checklist do README); refresh token continua válido 8 dias depois (verificação manual registrada no plano).

### 8.2 Tipos de evento
Objetivo: o dono cria e ajusta tipos de reunião numa tela só.

Fluxo: lista (`/painel/tipos`) → "Novo tipo" ou toque num card → editor → Salvar. Card com nome, duração, "Google Meet", selo "Oculto"/"Inativo", botões **Copiar link** e **Abrir**. Estado vazio: "Nenhum tipo de reunião ainda." + botão "Criar o primeiro".

- [ ] Criar tipo só com nome e duração funciona; os outros campos assumem os defaults de 7.3.
- [ ] Slug do tipo é sugerido a partir do nome (regra 11.11) e editável; slug repetido na conta mostra "Esse endereço já está em uso."
- [ ] "Copiar link" copia `https://{domínio}/{slug-conta}/{slug-tipo}` e mostra "Link copiado." por 2 s.
- [ ] Tipo com `visivel_na_pagina = false` não aparece em `/{slug}`, mas `/{slug}/{tipo}` funciona.
- [ ] Tipo `ativo = false` mostra a mensagem de indisponível no link direto e não aceita `POST /api/reservas`.
- [ ] Excluir pede confirmação, faz soft delete e não afeta reservas futuras já confirmadas (continuam valendo e aparecem em Reuniões).
- [ ] Reordenar (arrastar no desktop, setas no celular) persiste `ordem`.

### 8.3 Disponibilidade
Objetivo: horários semanais, datas específicas e feriados numa tela.

Fluxo: `/painel/disponibilidade` com três blocos: **Horários semanais** (uma linha por dia, faixas `10:30 – 12:00`, botão + para nova faixa, × para remover, "copiar para…" outros dias, dia sem faixa = "Indisponível"), **Datas específicas** (lista + "Adicionar data": escolher data no calendário, marcar "Indisponível o dia todo" ou faixas próprias) e **Feriados** (chave geral "Brasil" + lista dos feriados com a próxima data e uma chave cada, regra 11.4). Salvar por bloco.

- [ ] Faixas sobrepostas no mesmo dia mostram "Esses horários se sobrepõem." e nada é salvo.
- [ ] "Copiar para…" replica as faixas do dia nos dias marcados.
- [ ] Data específica indisponível remove todos os horários daquela data na página pública.
- [ ] Data específica com horário especial substitui as faixas semanais só naquela data.
- [ ] Desligar um feriado faz a data voltar a ter horários (se cair em dia com faixa); desligar a chave geral libera todos.
- [ ] Datas passadas somem da lista de datas específicas (não são apagadas).

### 8.4 Motor de disponibilidade
Objetivo: calcular os horários livres exatamente pela regra 11.2.

- [ ] `computeSlots()` é função pura em `src/features/availability/compute.ts`, sem I/O, coberta pelos casos da seção 22 (feriado, exceção, antecedência, janela, folgas, passo, fuso do convidado, troca de dia por fuso).
- [ ] `GET /api/disponibilidade?conta=&tipo=&de=&ate=` devolve dias com horários em ISO UTC; consulta o Google `freebusy` uma vez por chamada para o intervalo inteiro.
- [ ] Com o Google respondendo erro ou demorando mais de 5 s, a rota responde `servico_indisponivel` e a tela mostra "Não consegui consultar a agenda agora. Tente de novo em instantes." (princípio 2: nenhum horário oferecido).
- [ ] Com a conexão `revogada`, a página mostra "Agenda temporariamente indisponível."
- [ ] Um compromisso de 15:00–15:30 no Google remove todos os horários que o tocam (com as folgas do tipo).

### 8.5 Página pública e reserva
Objetivo: o convidado marca em dois cliques (princípio 0.1).

Fluxo: `/{slug}` (nome, mensagem, cards dos tipos) → `/{slug}/{tipo}`: à esquerda nome do dono, tipo, duração, "Google Meet"; à direita calendário do mês (dias com horário em azul, sem horário em cinza, hoje com ponto), fuso do convidado (detectado, trocável). Ao tocar no dia, lista de horários; ao tocar no horário, ele vira "Próximo" → formulário (Nome, E-mail, "Algo que eu deva saber?" opcional) → **Confirmar reunião** → `/{slug}/{tipo}/confirmado?r=…` com resumo, link do Meet e "Enviamos a confirmação para {e-mail}."
Estados: carregando horários (esqueleto do calendário); mês sem horário ("Sem horários neste mês." + "Ver próximo mês"); horário tomado no envio ("Esse horário acabou de ser reservado. Escolha outro." e volta à lista atualizada); erro do Google.

- [ ] Abre já no primeiro mês com horário livre dentro da janela.
- [ ] Horários exibidos no fuso do convidado; trocar o fuso atualiza a lista sem recarregar.
- [ ] `POST /api/reservas` revalida o horário no servidor (regra 11.2) com `freebusy` atual antes de gravar; dados do navegador além de tipo, início, nome, e-mail, observação, fuso e honeypot são ignorados.
- [ ] Dois envios simultâneos para o mesmo horário: exatamente um confirma, o outro recebe `horario_indisponivel` (teste de banco da constraint + teste de rota).
- [ ] Reserva confirmada cria evento no Google com título, descrição, participante e Meet da regra 11.5; o convidado recebe o convite do Google.
- [ ] Falha do Google no insert deixa a reserva `falhou` (libera o horário) e o convidado vê "Não consegui criar a reunião. Nada foi marcado. Tente de novo."
- [ ] Após confirmar, `ag_notificacoes` tem `confirmacao_convidado` e `aviso_dono_nova` `enviada`.
- [ ] Honeypot preenchido ou limite da regra 11.8 estourado → recusado sem criar nada.
- [ ] Página `/{slug}` inexistente → 404 com "Página não encontrada."

### 8.6 Gerenciar, cancelar e remarcar (convidado)
Fluxo: link do e-mail → `/r/{token}`: resumo (tipo, data e hora no fuso do convidado, link do Meet) + botões **Remarcar** e **Cancelar**. Cancelar → motivo opcional → "Cancelar reunião" → "Reunião cancelada." Remarcar → mesmo calendário do 8.5 (sem pedir nome/e-mail de novo) → "Confirmar novo horário".

- [ ] Token inválido → "Este link não é válido."; reserva já cancelada ou remarcada → mostra o estado e, se remarcada, link para a reserva nova.
- [ ] Depois do início da reunião, botões somem e aparece "Esta reunião já aconteceu ou está acontecendo."
- [ ] Cancelar: status `cancelada_convidado`, evento apagado no Google com `sendUpdates=all`, e-mail `aviso_dono_cancelada` ao dono.
- [ ] Remarcar: cria reserva nova (`remarcada_de_id`), faz `events.patch` no **mesmo** evento do Google (convidado recebe atualização, Meet mantido), antiga vira `remarcada`, novo token e novo e-mail `confirmacao_convidado`; dono recebe `aviso_dono_remarcada`. O horário antigo fica livre.
- [ ] Remarcar para horário tomado no meio do caminho → mensagem de horário tomado, reserva original intacta.

### 8.7 Reuniões (dono)
Fluxo: `/painel/reunioes` com abas **Próximas**, **Passadas**, **Canceladas**; agrupado por dia; linha com hora, nome do convidado, tipo, e-mail; toque abre detalhe (observação, Meet, histórico de remarcação, situação dos e-mails) com **Cancelar reunião** (motivo opcional, enviado ao convidado). Estado vazio: "Nenhuma reunião marcada."

- [ ] Lista só reservas da conta da sessão (teste de rota com duas contas).
- [ ] Cancelar pelo dono: `cancelada_dono`, evento apagado no Google com `sendUpdates=all`, e-mail `cancelamento_convidado` com o motivo e o link da página pública para marcar de novo.
- [ ] E-mail com `status = falhou` aparece no detalhe como "E-mail não enviado" com botão "Reenviar".
- [ ] Reservas `processando`/`falhou` não aparecem na lista.

### 8.8 Conta e conexão
Fluxo: `/painel/conta`: nome de exibição, endereço (`{domínio}/` + campo do slug, com disponibilidade checada ao digitar), mensagem de boas-vindas, fuso, bloco **Google Agenda** (e-mail conectado, "Consultando sua agenda principal", situação, botão Reconectar), **Excluir conta**.

- [ ] Trocar o slug avisa "Links antigos deixam de funcionar." e pede confirmação; os links `/r/{token}` continuam funcionando (não dependem do slug).
- [ ] Reconectar refaz o OAuth e volta `status = ativa` e `aviso_reconectar_enviado = false`.
- [ ] Excluir conta pede digitar o slug, revoga o token no Google (`oauth2.googleapis.com/revoke`), apaga a conta em cascata, **não** apaga eventos já criados no Google e encerra a sessão.

### 8.10 Cadastro aberto (v0.5; plano 9.1)
- [ ] Sem `EMAILS_PERMITIDOS`, qualquer e-mail Google cria conta; com ela, só os da lista (comportamento de antes).
- [ ] E-mail em `EMAILS_BLOQUEADOS` vê "Este e-mail não tem acesso." e nada é gravado.
- [ ] Com `CONTAS_NOVAS_POR_DIA` contas criadas nas últimas 24 h, um e-mail novo vê "Cadastros pausados por hoje. Tente amanhã." e nada é gravado; quem já tem conta entra sempre.

### 8.11 Primeiro acesso (v0.5; plano 9.2)
- [ ] Colunas novas em `ag_contas`: `termos_aceitos_em` e `suspensa_em` (timestamptz, nulas). Contas existentes ficam com o aceite nulo e passam uma vez pelas boas-vindas (aceite sem data inventada).
- [ ] Conta com `termos_aceitos_em` nulo vê, no lugar do painel, as boas-vindas (nome, endereço com checagem, fuso, aceite "Li e aceito os Termos de uso e a Política de privacidade"); sem o aceite, não avança; concluído (`POST /api/painel/conta/boas-vindas`), grava os dados e `termos_aceitos_em` e abre Tipos de evento.

### 8.12 Página inicial e páginas legais (v0.5; plano 9.3)
- [ ] `/` sem sessão mostra a página inicial do Reunião (o que é, "Entrar com Google", rodapé Privacidade · Termos · "Um produto DabLab"); com sessão, vai para o painel.
- [ ] `/privacidade` traz a política completa em nome da DabLab (dados do dono e do convidado, uso do Google Agenda com a declaração de uso limitado da Google API Services User Data Policy, retenção, direitos LGPD, contato `alexandre@dablab.com.br`); com `?de={slug}`, mantém o contato do dono daquela página.
- [ ] `/termos` traz os termos de uso (serviço gratuito sem garantia, responsabilidade do dono pelos dados dos convidados, uso proibido, suspensão, foro de São Paulo/SP).
- [ ] As páginas públicas e a tela de entrar têm links para Privacidade e Termos. Textos em `copy.ts`.

### 8.13 Proteções para uso público (v0.5; plano 9.4)
- [ ] Conta com `suspensa_em`: tratada como inexistente nas páginas públicas (404), sem horários nem reservas; a sessão deixa de valer (401) e o login mostra "Esta conta está suspensa." sem trocar o token; reativar (`suspensa_em = null`) devolve tudo.
- [ ] Rate limit de `POST /api/reservas` no Vercel Firewall (10/min por IP), documentado no README.

### 8.9 Faxina diária, documentação e entrega
- [ ] `/api/cron/diario` (protegido por `CRON_SECRET`) faz: reenvio de notificações `falhou`/`pendente` com menos de 5 tentativas; `processando` com mais de 10 min → `falhou`; anonimização da regra 11.12. É idempotente: rodar duas vezes seguidas não reenvia nada.
- [ ] `DOCUMENTACAO-TECNICA.md`, `CLAUDE.md` e README (com checklist do Google Cloud, Resend e DNS) completos.
- [ ] Seed `seed:calendly` grava os 5 tipos da regra 11.9 na conta indicada.

---

## 9. Fluxos principais ponta a ponta

**9.1 Primeira configuração (dono)**
1. Alexandre cria o projeto no Google Cloud, a tela de consentimento (Externo, "Em produção") e o cliente OAuth Web com o redirect `https://{domínio}/api/auth/google/callback` (README).
2. Verifica o domínio no Resend (DNS) e na Vercel.
3. Entra com o Gmail pessoal → aceita o aviso de app não verificado → marca as permissões de agenda.
4. Cai em Tipos de evento com "Reunião de 30 minutos" já pronta e a disponibilidade padrão.
5. Ajusta o endereço em Conta, copia o link e testa marcando com outro e-mail.
6. Depois de validar, sai e entra com `asq@bbz.com.br` (nova conta, novo slug), roda `seed:calendly` e troca o link nas assinaturas de e-mail. Cancela o Calendly.

**9.2 Convidado marca** → seção 8.5. **9.3 Convidado remarca/cancela** → seção 8.6. **9.4 Dono cancela** → seção 8.7.

**9.5 Exceções**
- Google revoga o acesso (senha trocada, permissão removida em myaccount.google.com): página pública fica indisponível, dono recebe um e-mail, reconecta pelo painel (seção 6).
- Dono apaga o evento direto no Google: a reserva continua `confirmada` no app e o horário continua bloqueado (assunção 24.6); o convidado recebe o cancelamento do Google, mas não o e-mail do app.
- Convidado recusa o convite no Google: nada muda no app (o evento é do dono); o caminho oficial é o link de cancelar.
- Resend fora do ar: reserva confirma assim mesmo (o convite do Google já chegou); e-mail fica `falhou` e a faxina reenvia.

---

## 10. Inventário de telas

| Tela | Rota | Mostra / ações | Lê | Escreve |
|---|---|---|---|---|
| [Público] Entrar | `/entrar` | logo, "Entrar com Google", erro de acesso | — | — (rota de auth escreve) |
| [Dono] Tipos de evento | `/painel/tipos` | cards, copiar link, abrir, novo, reordenar, link "Ver minha página" | `ag_tipos_evento`, `ag_contas` | `ag_tipos_evento.ordem` |
| [Dono] Editar tipo | `/painel/tipos/[id]` e `/painel/tipos/novo` | campos de 7.3 agrupados: **Básico** (nome, duração, descrição, endereço), **Local** (Google Meet liga/desliga), **Regras** (antecedência, janela, folgas, passo), **Visibilidade** (visível, ativo); excluir | `ag_tipos_evento` | `ag_tipos_evento` |
| [Dono] Reuniões | `/painel/reunioes` | abas Próximas/Passadas/Canceladas | `ag_reservas`, `ag_tipos_evento` | — |
| [Dono] Detalhe da reunião | `/painel/reunioes/[id]` | dados, Meet, histórico, e-mails, cancelar, reenviar e-mail | `ag_reservas`, `ag_notificacoes` | `ag_reservas`, `ag_notificacoes` |
| [Dono] Disponibilidade | `/painel/disponibilidade` | horários semanais, datas específicas, feriados | `ag_horarios_semanais`, `ag_excecoes_data`, `ag_contas` | os três |
| [Dono] Conta | `/painel/conta` | nome, endereço, mensagem, fuso, Google, excluir | `ag_contas`, `ag_conexoes_google` (só status/e-mail/escopos) | `ag_contas` |
| [Convidado] Página da conta | `/{slug}` | nome, mensagem, tipos visíveis e ativos | `ag_contas`, `ag_tipos_evento` | — |
| [Convidado] Escolher horário | `/{slug}/{tipo}` | resumo do tipo, calendário, fuso, horários, formulário | idem + `/api/disponibilidade` | `ag_reservas`, `ag_notificacoes` (via API) |
| [Convidado] Confirmado | `/{slug}/{tipo}/confirmado` | resumo, Meet, "adicionar à agenda" não é necessário (convite do Google) | `ag_reservas` (pelo id + token em cookie curto da confirmação) | — |
| [Convidado] Gerenciar reserva | `/r/{token}` | resumo, remarcar, cancelar | `ag_reservas` (pelo hash) | `ag_reservas` |
| [Convidado] Remarcar | `/r/{token}/remarcar` | calendário e horários do mesmo tipo | idem | `ag_reservas` |
| [Público] Não encontrada | 404 | "Página não encontrada." | — | — |

---

## 11. Regras de negócio

### 11.1 Fuso
| Regra | Valor | Onde |
|---|---|---|
| Faixas, exceções e feriados interpretados em | `ag_contas.fuso` (padrão `America/Sao_Paulo`) | servidor |
| Gravação | `timestamptz` em UTC | banco |
| Exibição ao convidado | fuso do navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`), trocável numa lista de fusos | cliente |
| Exibição ao dono e e-mails ao dono | `ag_contas.fuso` | servidor |
| E-mails ao convidado | `ag_reservas.fuso_convidado`, com o fuso escrito ("Horário de Brasília") | servidor |

### 11.2 Cálculo de horários livres (`computeSlots`, servidor)
Entrada: tipo de evento, faixas semanais, exceções, feriados ativos, ocupados (Google `freebusy` da agenda `primary` + reservas `processando`/`confirmada` da conta), agora, intervalo pedido.

| Passo | Regra |
|---|---|
| 1. Dias candidatos | de hoje (fuso da conta) até hoje + `janela_dias` − 1 |
| 2. Faixas do dia | se a data tem exceção `indisponivel` → nenhuma; se tem `horario_especial` → as faixas da exceção; senão, se é feriado ativo (11.4) → nenhuma; senão → faixas semanais do `dia_semana` |
| 3. Inícios possíveis | em cada faixa, começando no início da faixa e somando `passo_min`; o horário vale se `inicio + duracao_min ≤ fim da faixa` |
| 4. Antecedência | descarta início `< agora + antecedencia_min` |
| 5. Conflito | descarta se `[inicio − intervalo_antes_min, fim + intervalo_depois_min)` cruza qualquer ocupado. Encostar não é cruzar (ocupado até 15:00 permite começar 15:00 com folga 0) |
| 6. Saída | lista de inícios em UTC, ordenada, sem repetição |

Exemplos com a disponibilidade padrão (seg–sex 10:30–12:00 e 14:30–18:00), passo 30:
| Duração | Manhã | Tarde |
|---|---|---|
| 30 min | 10:30, 11:00, 11:30 | 14:30 … 17:30 (7 horários) |
| 60 min | 10:30, 11:00 | 14:30 … 17:00 (6 horários) |
| 90 min | 10:30 | 14:30 … 16:30 (5 horários) |
| 120 min | — | 14:30, 15:00, 15:30, 16:00 |

A faixa não "emenda" com a seguinte: uma reunião não atravessa o intervalo 12:00–14:30.

### 11.3 Validação ao reservar (servidor, `POST /api/reservas`)
| Checagem | Falha → código |
|---|---|
| Tipo existe, não excluído, `ativo`, conta com conexão `ativa` | `tipo_indisponivel` / `agenda_indisponivel` |
| Início pertence à saída de `computeSlots` recalculada agora, com `freebusy` atual | `horario_indisponivel` |
| `fim = inicio + duracao_min` (calculado no servidor, nunca vindo do navegador) | — |
| Nome 1–100, e-mail válido, observação ≤ 1.000, fuso IANA válido | `dados_invalidos` |
| Regra 11.8 | `limite_excedido` |
| INSERT viola `ag_reservas_sem_sobreposicao` | `horario_indisponivel` |

### 11.4 Feriados nacionais (calculados em código, `src/features/availability/holidays.ts`)
| Código | Feriado | Data | Ligado por padrão |
|---|---|---|---|
| `confraternizacao` | Confraternização Universal | 01/01 | sim |
| `carnaval_segunda` | Carnaval (segunda) | Páscoa − 48 dias | não |
| `carnaval_terca` | Carnaval (terça) | Páscoa − 47 dias | não |
| `cinzas` | Quarta-feira de Cinzas | Páscoa − 46 dias | não |
| `sexta_santa` | Sexta-feira Santa | Páscoa − 2 dias | sim |
| `tiradentes` | Tiradentes | 21/04 | sim |
| `trabalho` | Dia do Trabalho | 01/05 | sim |
| `corpus_christi` | Corpus Christi | Páscoa + 60 dias | não |
| `independencia` | Independência | 07/09 | sim |
| `aparecida` | Nossa Senhora Aparecida | 12/10 | sim |
| `finados` | Finados | 02/11 | sim |
| `republica` | Proclamação da República | 15/11 | sim |
| `consciencia_negra` | Consciência Negra | 20/11 | sim |
| `natal` | Natal | 25/12 | sim |

Páscoa pelo algoritmo gregoriano anônimo (Meeus/Jones/Butcher); casos de teste: 2026 → 05/04, 2027 → 28/03, 2028 → 16/04.
Feriado ativo = `feriados_ativos = true` **e** código fora de `feriados_desligados`. "Ligado por padrão = não" significa que, na criação da conta, o código já entra em `feriados_desligados`.
Feriados estaduais e municipais: o dono cria uma data específica `indisponivel`.

### 11.5 Evento no Google
| Campo | Valor |
|---|---|
| Agenda | `primary` da conta |
| `summary` | `{nome do tipo} · {nome_convidado}` |
| `description` | `Agendado por {nome_convidado} ({email_convidado}).` + observação (se houver) + `Para cancelar ou remarcar: {URL}/r/{token}` |
| `attendees` | `[{ email: email_convidado, displayName: nome_convidado }]` |
| `conferenceData.createRequest` | `{ requestId: reserva.id, conferenceSolutionKey: { type: 'hangoutsMeet' } }` só se `com_meet` (query `conferenceDataVersion=1`) |
| `sendUpdates` | `all` em insert, patch e delete |
| `reminders` | padrão da agenda |
| Idempotência | `id` do evento do Google derivado da reserva (`ag` + uuid sem hífens, base32hex válido), para que repetir o insert não duplique |
| Meet | `link_meet` = `hangoutLink` da resposta; se a conferência voltar `pending`, buscar o evento de novo até 3× com 1 s de intervalo; se continuar sem link, confirmar sem Meet e registrar no log |

### 11.6 E-mails (Resend)
| Tipo | Para | Quando | Conteúdo mínimo |
|---|---|---|---|
| `confirmacao_convidado` | convidado | reserva confirmada (nova ou remarcada) | tipo, data/hora no fuso do convidado, Meet, links Remarcar e Cancelar (`/r/{token}`) |
| `aviso_dono_nova` | `ag_contas.email` | reserva confirmada nova | convidado, e-mail, tipo, data/hora, observação |
| `aviso_dono_remarcada` | dono | remarcação | horário antigo → novo |
| `aviso_dono_cancelada` | dono | convidado cancelou | convidado, horário, motivo |
| `cancelamento_convidado` | convidado | dono cancelou | horário, motivo, link `/{slug}` para marcar de novo |
| `reconectar_google` | dono | conexão virou `revogada` | link `/painel/conta` |

Envio logo após a ação (fora da transação; uma falha não desfaz a reserva). Até 5 tentativas no total (a do momento + reenvios da faxina diária). `Idempotency-Key` do Resend = `ag_notificacoes.id`. Remetente `"{nome_exibicao} <agenda@{domínio}>"`, `reply_to` = e-mail do dono nos e-mails ao convidado e = e-mail do convidado nos avisos ao dono.

### 11.7 Token de gestão
32 bytes de `crypto.randomBytes`, base64url (43 caracteres) no link; banco guarda SHA-256 hex. Remarcar gera token novo; o antigo continua abrindo a reserva antiga (que mostra "Remarcada" e aponta para a nova). Sem expiração.

### 11.8 Limites contra abuso
| Regra | Valor | Onde |
|---|---|---|
| Reservas futuras `confirmada` por e-mail de convidado, por conta | máx. 3 | servidor |
| Honeypot (campo invisível `site`) | preenchido → recusa silenciosa com resposta de sucesso falsa, sem gravar | servidor |
| Tamanhos | 11.3 | servidor + zod |

### 11.9 Padrões de conta nova e seed do Calendly
Conta nova (no primeiro login):
- Faixas: seg a sex, 10:30–12:00 e 14:30–18:00. Sábado e domingo indisponíveis.
- Feriados: tabela 11.4.
- Tipo: "Reunião de 30 minutos", 30 min, Meet, defaults de 7.3.
- Slug sugerido: parte local do e-mail normalizada pela regra 11.11 (ex.: `alexandre.silva.siqueira` → `alexandre-silva-siqueira`); se ocupado, acrescenta `-2`, `-3`…

`seed:calendly` (idempotente por slug do tipo; não duplica):
| Nome | Slug | Duração |
|---|---|---|
| Entrevistas | `entrevistas` | 60 |
| Reunião de 2h | `reuniao-2h` | 120 |
| Reunião de 1,5h | `reuniao-1-5h` | 90 |
| Reunião de 1h | `reuniao-1h` | 60 |
| Reunião de 30 minutos | `reuniao-30-minutos` | 30 |

### 11.10 Cifra do refresh token
AES-256-GCM com `TOKEN_ENC_KEY` (32 bytes em base64), IV de 12 bytes aleatório por gravação. Só `src/server/google/` decifra. O access token não é gravado: é obtido a cada uso (cache em memória do processo até 5 min antes de expirar).

### 11.11 Slugs
Normalização: minúsculas, sem acento, espaços e pontos viram `-`, remove o que não for `[a-z0-9-]`, junta hífens repetidos, corta a 30. Reservados para a conta: `painel`, `entrar`, `sair`, `api`, `r`, `_next`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `ajuda`, `termos`, `privacidade`.

### 11.12 Retenção
A faxina diária anonimiza reservas com `fim` há mais de 24 meses: `nome_convidado = 'Convidado'`, `email_convidado = 'anonimo@invalid'`, `observacao = null`, `motivo_cancelamento = null`, grava `dados_anonimizados_em`.

### 11.13 O que não é automático
- O app não lê o título nem os participantes dos compromissos do Google: só livre/ocupado.
- Eventos criados ou apagados direto no Google não viram nem cancelam reservas (assunção 24.6).
- Sem lembretes do app; os lembretes são os do Google Agenda.

---

## 12. Máquina de estado da reserva

```
            INSERT
              │
         processando ──(Google falhou / >10 min)──▶ falhou
              │ events.insert ok
              ▼
          confirmada ──(convidado cancela)──▶ cancelada_convidado
              │      ──(dono cancela)──────▶ cancelada_dono
              │      ──(convidado remarca)─▶ remarcada  (a nova nasce em processando → confirmada)
```

| De → para | Permitido quando |
|---|---|
| `processando` → `confirmada` | evento criado ou atualizado no Google |
| `processando` → `falhou` | erro do Google, ou faxina (> 10 min) |
| `confirmada` → `cancelada_*` | `agora < inicio` e o delete no Google deu certo ou o evento já não existia (404/410) |
| `confirmada` → `remarcada` | `ag_fn_remarcar_reservar` (passo 1 abaixo) |
| `remarcada` → `confirmada` | só em `ag_fn_desfaz_remarcacao`, quando o patch no Google falhou |
| qualquer outra | proibida; o servidor recusa com `transicao_invalida` |

Remarcar, passo a passo (o horário novo pode cruzar o antigo, ex.: adiar 30 min uma reunião de 1 h):
1. Função `ag_fn_remarcar_reservar(antiga_id, inicio, fim, token_hash_novo)`, numa transação: trava a antiga (`FOR UPDATE`), confere que está `confirmada` e futura, muda a antiga para `remarcada` e insere a nova `processando` com `remarcada_de_id` e o mesmo `google_evento_id`. Como a antiga já saiu do conjunto ativo, a constraint 7.3 compara a nova só com as outras reservas. Violação → `horario_indisponivel` e nada muda.
2. `events.patch` no Google com o horário novo.
3. Sucesso → nova `confirmada`. Falha → função `ag_fn_desfaz_remarcacao(nova_id)`: nova `falhou`, antiga volta a `confirmada` (única transição `remarcada → confirmada` permitida). Se a volta violar a constraint (alguém pegou o horário antigo nesses segundos), a antiga fica `remarcada`, a nova `falhou`, e o dono recebe `aviso_dono_cancelada` com o motivo "falha ao remarcar". Esse caso é registrado no log e coberto por teste.
Erros do Google ao cancelar (rede, 5xx): a reserva continua `confirmada` e o usuário vê "Não consegui cancelar agora. Tente de novo." (o horário não pode ficar livre no app com o evento ainda no Google).

---

## 13. Contratos de API

Todas as respostas de erro: `{ "erro": "<codigo>" }` com o status HTTP indicado; o cliente traduz pelo dicionário em `src/lib/copy.ts`.

| Rota | Método | Auth | Entrada | Saída / erros |
|---|---|---|---|---|
| `/api/auth/google` | GET | — | — | 302 para o Google |
| `/api/auth/google/callback` | GET | state | `code`, `state` | 302 `/painel/tipos` · `/entrar?erro=sem_acesso|escopos|falha` |
| `/sair` | POST | sessão | — | 303 `/entrar` |
| `/api/disponibilidade` | GET | — | `conta` (slug), `tipo` (slug), `de`, `ate` (YYYY-MM-DD, ≤ 42 dias) | 200 `{ fuso_conta, dias: [{ data, horarios: [iso] }] }` · 404 `nao_encontrado` · 503 `servico_indisponivel`/`agenda_indisponivel` |
| `/api/reservas` | POST | — | `{ conta, tipo, inicio, nome, email, observacao?, fuso, site }` | 201 `{ id, inicio, fim, link_meet }` + cookie curto de confirmação · 409 `horario_indisponivel` · 422 `dados_invalidos` · 429 `limite_excedido` · 503 |
| `/api/reservas/gestao` | GET | token | `token` | 200 resumo público da reserva (nunca o id da conta nem e-mails além do do próprio convidado) · 404 |
| `/api/reservas/gestao/cancelar` | POST | token | `{ token, motivo? }` | 200 · 409 `transicao_invalida`/`reuniao_iniciada` · 503 |
| `/api/reservas/gestao/remarcar` | POST | token | `{ token, inicio, fuso }` | 201 `{ id, inicio, fim, link_meet }` (novo token vai só no e-mail) · 409 · 503 |
| `/api/painel/tipos` (+ `/[id]`) | GET/POST/PATCH/DELETE | sessão | campos de 7.3 (schema de PATCH sem defaults) | 200/201 · 409 `slug_em_uso` · 422 |
| `/api/painel/tipos/ordem` | POST | sessão | `{ ids: uuid[] }` | 200 |
| `/api/painel/disponibilidade/semanal` | PUT | sessão | `{ faixas: [{ dia_semana, inicio, fim }] }` | 200 · 422 `faixa_sobreposta` |
| `/api/painel/disponibilidade/datas` | PUT/DELETE | sessão | `{ data, tipo, faixas? }` | 200 · 422 |
| `/api/painel/disponibilidade/feriados` | PUT | sessão | `{ feriados_ativos, feriados_desligados }` | 200 |
| `/api/painel/reunioes` (+ `/[id]`) | GET | sessão | `aba`, cursor | 200 lista paginada (50) |
| `/api/painel/reunioes/[id]/cancelar` | POST | sessão | `{ motivo? }` | 200 · 409 · 503 |
| `/api/painel/notificacoes/[id]/reenviar` | POST | sessão | — | 200 · 409 `limite_tentativas` |
| `/api/painel/conta` | GET/PATCH/DELETE | sessão | campos de `ag_contas` editáveis; DELETE `{ confirmacao: slug }` | 200 · 409 `slug_em_uso` · 422 `slug_reservado` |
| `/api/painel/conta/slug-disponivel` | GET | sessão | `slug` | `{ disponivel: boolean }` |
| `/api/cron/diario` | GET | `Authorization: Bearer CRON_SECRET` | — | 200 `{ reenviados, falhados, anonimizados }` |

Toda rota `/api/painel/*` chama `requireConta()` na primeira linha. Toda rota de gestão chama `requireReservaPorToken()`. Ambas em `src/server/auth/`.

---

## 14. Relatórios, exportação e importação
Não há no MVP. Os dados de reunião ficam também no Google Agenda.

---

## 15. Copy e tom de voz
Tom: direto, cordial, primeira pessoa do dono na página pública, sem exclamações. Conteúdo **final**, centralizado em `src/lib/copy.ts`.

| Onde | Texto |
|---|---|
| Página da conta, sem mensagem própria | "Escolha um tipo de reunião." |
| Calendário, título | "Escolha uma data e horário" |
| Fuso | "Fuso horário" |
| Botão do horário | "Próximo" |
| Formulário, título | "Seus dados" |
| Campos | "Nome", "E-mail", "Algo que eu deva saber? (opcional)" |
| Botão | "Confirmar reunião" |
| Confirmado | "Reunião marcada." / "Enviamos a confirmação para {email}. O convite do Google Agenda também já chegou." |
| Horário tomado | "Esse horário acabou de ser reservado. Escolha outro." |
| Mês vazio | "Sem horários neste mês." / "Ver próximo mês" |
| Google com erro | "Não consegui consultar a agenda agora. Tente de novo em instantes." |
| Agenda revogada | "Agenda temporariamente indisponível." |
| Falha ao criar | "Não consegui criar a reunião. Nada foi marcado. Tente de novo." |
| Tipo inativo | "Este tipo de reunião não está disponível." |
| Limite | "Você já tem reuniões marcadas comigo. Para marcar outra, cancele uma delas pelo link do e-mail." |
| Gerenciar, título | "Sua reunião" |
| Botões | "Remarcar", "Cancelar reunião", "Confirmar novo horário" |
| Cancelada | "Reunião cancelada. Avisei {nome do dono}." |
| Reunião passada | "Esta reunião já aconteceu ou está acontecendo." |
| Link inválido | "Este link não é válido." |
| Entrar | "Entrar com Google" / sem acesso: "Este e-mail não tem acesso." / escopos: "Para funcionar, marque as duas permissões de agenda." |
| Painel, vazio de tipos | "Nenhum tipo de reunião ainda." / "Criar o primeiro" |
| Painel, vazio de reuniões | "Nenhuma reunião marcada." |
| Copiar link | "Copiar link" → "Link copiado." |
| Faixas sobrepostas | "Esses horários se sobrepõem." |
| Slug em uso | "Esse endereço já está em uso." |
| Troca de slug | "Links antigos deixam de funcionar. Continuar?" |
| Faixa de reconexão | "Sua agenda do Google foi desconectada. Ninguém consegue marcar até você reconectar." / "Reconectar Google" |

Assuntos dos e-mails:
| Tipo | Assunto |
|---|---|
| `confirmacao_convidado` | "Confirmado: {tipo} com {dono} · {dia, dd/mm às hh:mm}" |
| `aviso_dono_nova` | "Nova reunião: {convidado} · {dd/mm hh:mm}" |
| `aviso_dono_remarcada` | "Remarcada: {convidado} · {dd/mm hh:mm} → {dd/mm hh:mm}" |
| `aviso_dono_cancelada` | "Cancelada: {convidado} · {dd/mm hh:mm}" |
| `cancelamento_convidado` | "Cancelada: {tipo} com {dono} · {dd/mm hh:mm}" |
| `reconectar_google` | "Sua agenda foi desconectada" |

---

## 16. Direção visual

**Referência:** o Orçamento da Casa (seção 16 do spec dele) e o visual Apple (apple.com, Calendário do macOS, App Store Connect). Mesma família visual para o Alexandre reconhecer os apps como dele.

- **Tipografia:** pilha de sistema `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif`. Títulos grandes e pesados (700, tracking negativo). Horas com `tabular-nums`.
- **Cor de marca:** azul `#0071e3` (claro) / `#0a84ff` (escuro), único destaque: dias com horário, horário selecionado, botões primários, item ativo do menu. Fundo branco / preto; superfícies `#f5f5f7` / `#1c1c1e`; texto secundário `#6e6e73` / `#98989d`.
- **Cores semânticas (só com significado):** vermelho `#ff3b30`/`#ff453a` = cancelar/cancelada/erro; verde `#34c759`/`#30d158` = confirmada; laranja `#ff9500`/`#ff9f0a` = atenção (reconectar Google, e-mail não enviado). O azul nunca indica status.
- **Forma:** cards com cantos de 22–24 px sem borda sobre a superfície; hairlines de 1 px em listas; muito espaço em branco; sem sombra pesada. Dias do calendário em círculos de 44 px; horários em pílulas de largura total (44 px de altura).
- **Página pública:** uma coluna no celular; no desktop (≥ 900 px), cartão central de até 1.000 px com duas colunas (resumo à esquerda, calendário à direita), como no Calendly, sem logo de terceiros. Ao escolher o dia, a lista de horários aparece ao lado do calendário no desktop e abaixo dele no celular.
- **Navegação do painel:** menu lateral no padrão App Store Connect no desktop (≥ 1024 px). Grupos com título em **negrito escuro**, caixa normal (sem MAIÚSCULAS): **Agenda** (Tipos de evento, Reuniões) e **Configurar** (Disponibilidade, Conta). Itens indentados sem marcador; hairline entre os grupos; um item ativo por vez em azul `#0071e3` com pílula azul clara ao fundo; rodapé com nome e e-mail da conta, link "Ver minha página" e Sair. Abaixo de 1024 px, o menu vira gaveta aberta por botão no topo.
- **Modo escuro:** obrigatório, seguindo o sistema, nas duas áreas (painel e página pública).
- **E-mails:** HTML simples, fundo branco, título grande, botão azul arredondado, rodapé discreto; versão texto puro junto.
- **Livre para o agente:** ícones (conjunto de traço fino, ex.: lucide), microanimações discretas, o seletor de horário (input nativo `time` ou lista de 5 em 5 min).

---

## 17. Requisitos não-funcionais

| Item | Alvo |
|---|---|
| Página pública com horários do mês visíveis | < 2 s em 4G (p75) |
| `POST /api/reservas` até a confirmação | < 4 s típico (inclui Google) |
| Timeout por chamada ao Google | 5 s; uma nova tentativa só em leitura (`freebusy`) |
| Volume | até 5 contas, ~100 reservas/mês |
| Navegadores | Safari iOS 17+, Chrome Android atual, Safari/Chrome/Edge desktop atuais |
| Acessibilidade | contraste AA, toque ≥ 44 px, calendário navegável por teclado (setas) e com `aria-label` por dia ("terça, 4 de novembro, 9 horários"), foco visível |
| Idioma | pt-BR; datas "terça-feira, 4 de novembro"; 24 h |
| Offline | não suportado |
| SEO | `noindex` por padrão; página inicial, privacidade e termos indexáveis e `/robots.txt` (assunção 24.8, emenda v0.5) |

---

## 18. Convenções de código e repositório

- **Idioma:** banco em português `snake_case` com prefixo `ag_`; código, variáveis e arquivos em inglês. Fronteira em `src/server/db/` (tipos gerados mantêm os nomes do banco; os helpers expõem nomes em inglês).
- **Comentários:** toda função, rota, hook, trigger e função SQL com cabeçalho em português: o que faz, recebe, devolve e a regra (ex.: `// Implementa a regra 11.2 (passo 5)`). Lógica não óbvia com comentário inline.
- **Segredos** só em `src/server/` e `scripts/`. Nenhum `NEXT_PUBLIC_` com segredo.
- **Copy** só em `src/lib/copy.ts` (pt-BR); facilita a v2 em inglês.
- **Pastas:**
```
src/
  app/
    (publico)/[slug]/page.tsx, [slug]/[tipo]/page.tsx, [slug]/[tipo]/confirmado/page.tsx
    (publico)/r/[token]/page.tsx, r/[token]/remarcar/page.tsx
    (publico)/entrar/page.tsx
    painel/(layout com menu)/tipos, reunioes, disponibilidade, conta
    api/... (seção 13)
    sair/route.ts
  features/
    availability/  compute.ts (puro), holidays.ts (puro), components/
    booking/       server.ts, components/
    event-types/   server.ts, components/
    meetings/      server.ts, components/
    account/       server.ts, components/
  server/
    auth/     session.ts, require-conta.ts, require-reserva.ts
    db/       client.ts (service role), types.ts (gerado), queries por tabela
    google/   oauth.ts, calendar.ts, crypto.ts
    email/    resend.ts, templates/
  lib/        copy.ts, slug.ts, time.ts
  proxy.ts
supabase/ migrations/, tests/ (pgTAP), schema.sql
scripts/  seed-calendly.ts
tests/    (Vitest)
plans/
```
- **Variáveis de ambiente:**
| Variável | Pública? | Uso |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | sim | URL base (links) |
| `SUPABASE_URL` | não | |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** | `src/server/db/client.ts` |
| `GOOGLE_CLIENT_ID` | não | OAuth |
| `GOOGLE_CLIENT_SECRET` | **secreta** | OAuth |
| `TOKEN_ENC_KEY` | **secreta** | regra 11.10 |
| `SESSION_SECRET` | **secreta** | seção 6 |
| `EMAILS_PERMITIDOS` | não (só servidor) | seção 5; v0.5: opcional (vazia = aberto) |
| `EMAILS_BLOQUEADOS` | não (só servidor) | v0.5, seção 6 |
| `CONTAS_NOVAS_POR_DIA` | não (só servidor) | v0.5, seção 6 (padrão 50) |
| `RESEND_API_KEY` | **secreta** | e-mail |
| `EMAIL_REMETENTE` | não | `agenda@{domínio}` |
| `CRON_SECRET` | **secreta** | `/api/cron/diario` |
| (v2) `TURNSTILE_SECRET_KEY` | secreta | reservado |
- **Documentação viva:** `supabase/schema.sql` filtrado a `ag_`, README (setup local, Google Cloud passo a passo, Resend/DNS, Vercel, variáveis), `DOCUMENTACAO-TECNICA.md` (seção 19), `CLAUDE.md` (uma página; comandos com saída saudável; pegadinhas; "quando o agente errar a mesma coisa duas vezes, a correção entra aqui"). Tudo atualizado no mesmo commit da mudança.
- **Next.js 16:** ler `node_modules/next/dist/docs/` antes de usar API nova; leitura de cookies dentro de `<Suspense>` (Cache Components); `proxy.ts` no lugar de middleware.

### 18.1 Guardrails executáveis

| Regra | Origem | Mecanismo |
|---|---|---|
| Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENC_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`) e import de `src/server/` nunca em código de cliente | 18, 20 | hook `guard-secrets.sh` |
| Migration versionada não se edita | 7.6 | hook `guard-migrations.sh` |
| Em correção de bug, teste não se edita | 22.1 | hook `guard-tests.sh` |
| Após migration: advisors + `schema.sql` | 7.6, 20 | hook `remind-advisors.sh` (aviso) |
| Toda rota do painel chama `requireConta()`; toda consulta filtra `conta_id` | 5, 6 | `REVIEW.md` + `verifier` + teste de rota com duas contas |
| Nunca oferecer horário quando o Google falha | 0.2, 8.4 | teste automatizado + `verifier` |
| Reserva sem sobreposição | 7.3 | exclusion constraint no banco + pgTAP |
| `import 'server-only'` em todo arquivo de `src/server/` | 20 | `REVIEW.md` + falha de build do Next |
| Critérios de aceite por épico | 8 | subagente `verifier` |

---

## 19. Documentação técnica final
Ao fim da implementação, gerar `DOCUMENTACAO-TECNICA.md` em português, a partir do que foi implementado: (1) modelo de dados explicado em linguagem de negócio, com enums; (2) relacionamentos com a cardinalidade em frase; (3) triggers, funções, constraints e o "RLS sem política" com nome exato e o que fazem; (4) mapa tela → rotas → tabelas; (5) lógica das ações principais por tela (o que valida, grava, calcula e onde; o que o usuário vê no erro); (6) divergências em relação a este spec. Toda mudança de schema, rota ou lógica de tela atualiza o documento no mesmo commit.

---

## 20. Privacidade, segurança e conformidade

| Dado | Por quê | Onde | Quem acessa | Retenção |
|---|---|---|---|---|
| Nome, e-mail, observação do convidado | marcar e avisar | `ag_reservas` | dono da conta | 24 meses, depois anonimizado (11.12) |
| Livre/ocupado da agenda do dono | calcular horários | só em memória, não gravado | servidor | não retido |
| Refresh token Google | criar eventos | `ag_conexoes_google`, cifrado | só `src/server/google/` | até excluir a conta ou desconectar |
| Logs | diagnóstico | Vercel | dono | padrão da Vercel; **nunca** registrar e-mail, nome, observação, token ou URL `/r/…` |

- **LGPD:** base legal = execução de procedimento a pedido do titular (art. 7º, V) para o convidado. A página pública tem link "Privacidade" com texto curto: o que é guardado, por quanto tempo e que o convidado pode pedir exclusão por e-mail ao dono (o dono cancela/apaga; a exclusão de reserva individual a pedido é manual na v1, assunção 24.9).
- **LGPD v0.5:** a DabLab é **controladora** dos dados dos donos (nome, e-mail, token do Google, configurações; base legal: execução de contrato, art. 7º, V, com aceite dos Termos registrado em `termos_aceitos_em`) e **operadora** dos dados dos convidados em nome de cada dono, que é o controlador deles. Política de privacidade e Termos de uso completos em `/privacidade` e `/termos` (épico 8.12). O uso dos dados do Google segue a Google API Services User Data Policy, inclusive os requisitos de uso limitado.
- **Segredos** só no servidor (18.1). Toda rota de painel com `requireConta()`; toda rota de token com `requireReservaPorToken()`. Service role ignora RLS: os helpers de `src/server/db/` exigem `conta_id` ou `token_hash` como parâmetro obrigatório.
- **CSRF:** rotas de escrita do painel aceitam só `POST/PUT/PATCH/DELETE` com cookie `SameSite=Lax` e conferem o cabeçalho `Origin` = `NEXT_PUBLIC_SITE_URL`.
- **OAuth:** `state` aleatório em cookie de 10 min; `id_token` validado (assinatura, `aud`, `iss`, `exp`).
- **Página de gestão:** `Referrer-Policy: no-referrer` e `noindex` em `/r/*`, para o token não vazar.
- **Supabase:** advisors (security + performance) após cada DDL, filtrando `ag_*`; funções com `search_path=''`; nenhuma `SECURITY DEFINER` exposta.

---

## 21. Métricas de sucesso
| Métrica | Alvo | Prazo |
|---|---|---|
| Calendly cancelado | sim | 30 dias após o deploy |
| Reservas confirmadas sem intervenção manual | ≥ 95% | primeiro mês |
| Reservas marcadas em cima de compromisso | 0 | sempre |
Sem analytics no MVP (a contagem vem de `ag_reservas`).

---

## 22. Estratégia de teste

| O quê | Como |
|---|---|
| `computeSlots` (11.2) | Vitest, função pura: tabela de exemplos 11.2; feriado ligado/desligado; exceção indisponível e especial; antecedência na borda; janela; folgas antes/depois encostando e cruzando; passo 45; convidado em `Europe/Lisbon` e `America/Los_Angeles` (horário muda de dia); ocupado do Google atravessando duas faixas |
| `holidays.ts` (11.4) | Páscoa 2026/2027/2028 e datas derivadas |
| Slug (11.11), token (11.7), cifra (11.10) | Vitest |
| Rotas | Vitest com Google e Resend simulados (módulo `src/server/google/calendar.ts` injetável): reserva feliz, horário tomado, Google 500, Google timeout, revogado (`invalid_grant`), limite 11.8, honeypot, cancelar, remarcar (dois casos da seção 12), duas contas não se enxergam |
| Banco | pgTAP no Supabase local: constraint de sobreposição (inclusive `[)`), `ag_fn_valida_faixas`, `anon`/`authenticated` sem acesso. Filtrar sempre pelos dados da fixture |
| Manual | OAuth real com Gmail pessoal; Meet criado; convite chega; e-mails chegam; teste com `asq@bbz.com.br` antes de cancelar o Calendly (risco 23.2) |

### 22.1 Loop de verificação
- `npm run typecheck` (`next typegen && tsc --noEmit`) · `npm run lint` · `npm test` (pgTAP local + Vitest) · `npm run build` · `npm run verify` (os quatro, para no primeiro erro). Saída saudável: termina com a tabela de rotas do `next build`, código 0.
- Nenhum épico é declarado pronto sem colar a saída do `npm run verify` e o relatório do `verifier` sem "não cumprido".
- Critério por épico: os critérios de 8.x; para 8.4, todos os casos de `computeSlots` passam; para 8.5, os testes de concorrência e de Google falhando passam; para telas, screenshot no navegador do app comparada com o design aprovado, em claro e escuro, em 375 px e 1280 px.
- **Bug:** teste que reproduz → ver falhar → commit → `touch .claude/fix-mode` → corrigir → `rm .claude/fix-mode`.
- **Regra de ouro** (literal no `CLAUDE.md`): se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.

---

## 23. Riscos e mitigação

| # | Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|---|
| 23.1 | App OAuth deixado em "Teste" no Google Cloud → refresh token expira em 7 dias e a página fica indisponível toda semana | alto | média | README manda publicar "Em produção"; critério 8.1 confere após 8 dias; e-mail de reconexão (seção 6) |
| 23.2 | Workspace da BBZ bloqueia apps não verificados para `asq@bbz.com.br` | alto (só para a conta BBZ) | média | testar a conta BBZ antes de cancelar o Calendly; se bloquear, pedir ao TI para marcar o Client ID como confiável (Admin → Segurança → Controles de API), sem mudança de código |
| 23.3 | Corrida: dois convidados no mesmo horário | alto | baixa | exclusion constraint 7.3 + revalidação 11.3 |
| 23.4 | Google lento/fora | médio | baixa | timeout 5 s, nenhum horário oferecido (princípio 2), mensagem clara |
| 23.5 | Dono apaga evento direto no Google e o horário continua bloqueado no app | baixo | média | documentado (24.6); cancelar pelo app; sincronização na v2 |
| 23.6 | E-mail cai no spam (domínio novo) | médio | média | SPF/DKIM/DMARC do Resend configurados no DNS (README); o convite do Google chega de qualquer forma |
| 23.7 | Projeto Supabase compartilhado: colisão de nome ou alteração acidental em tabela de outro app | alto | baixa | prefixo `ag_`; conferir colisão antes da primeira migration; advisors filtrados; nunca `db push` |
| 23.8 | `btree_gist` indisponível no projeto compartilhado | médio | baixa | conferir no 8.1; alternativa: trava por `pg_advisory_xact_lock(conta)` + checagem dentro da transação |
| 23.9 | Mais de 100 refresh tokens por conta Google/cliente (cada login gera um) invalida o mais antigo | baixo | baixa | sempre sobrescrever o token guardado a cada login; não há outro consumidor |
| 23.10 | Spam de reservas falsas | médio | baixa | honeypot + limite 11.8; Turnstile na v2 |

---

## 24. Assunções declaradas
**Assunção não revisada vira verdade no minuto em que o agente começa a codar.**

| # | Assunção | Por quê | Se discordar |
|---|---|---|---|
| 24.1 | Cada e-mail Google é uma conta separada, com login separado (sair e entrar com o outro) | "podem ser contas separadas"; mais simples | Dá para ter troca rápida de conta no menu (v2) |
| 24.2 | Entrar com Google **é** conectar a agenda (um consentimento só) | menos passos; não há senha | Separar login (e-mail mágico) e conexão é possível, com mais uma tela |
| 24.3 | Só a agenda principal (`primary`) é consultada e recebe os eventos | igual ao seu Calendly atual ("Consultando uma agenda") | Várias agendas na v2 (seção 28) |
| 24.4 | "Reunião de 2h" terá **120 min** no seed, embora no Calendly ela esteja com 1 h 30 (igual à de 1,5 h) | o nome diz 2 h; parece engano no Calendly | Se era de propósito, troco para 90 |
| 24.5 | Antecedência mínima padrão de 4 h, janela de 60 dias, passo de 30 min, sem folgas | padrões do Calendly | Ajustável por tipo no painel |
| 24.6 | Cancelar se faz pelo app; evento apagado direto no Google não libera o horário no app | sincronização exige push do Google | v2 |
| 24.7 | Dono não remarca pelo painel; cancela com motivo e o convidado marca de novo | raro; mantém o painel simples | Remarcar pelo dono na v2 |
| 24.8 | Todas as páginas com `noindex` (não aparecem no Google) | link é compartilhado diretamente | Liberar indexação da página da conta |
| 24.8 (v0.5, 09/11/2026) | **Emenda:** página inicial, `/privacidade` e `/termos` com `index, follow` e `/robots.txt` de verdade (bloqueia `/painel`, `/r/`, `/api/`); o resto continua `noindex`. Motivo: a revisão do OAuth do Google não conseguia ler as páginas (bug B-03) | — | — |
| 24.9 | Exclusão de dados de um convidado a pedido é feita pelo agente/manual na v1 | pedido raríssimo | Botão "apagar dados" no detalhe da reunião |
| 24.10 | Feriados: os 8 do seu Calendly + Sexta-feira Santa e Consciência Negra ligados; Carnaval, Cinzas e Corpus Christi desligados | Consciência Negra é feriado nacional desde 2024; os outros são ponto facultativo | Liga/desliga na tela |
| 24.11 | Sem lembrete por e-mail do app | o Google Agenda já lembra | v2 |
| 24.12 | Interface só em pt-BR | convidados hoje são brasileiros | v2 em inglês (copy centralizada) |
| 24.13 | O convidado recebe dois e-mails na confirmação (convite do Google + e-mail do app com os links) | o convite do Google não tem os links de remarcar/cancelar do app | Tirar o e-mail do app e pôr os links só na descrição do evento |

---

## 25. Perguntas abertas
O agente de código **para e pergunta** ao cruzar com qualquer item abaixo.

| # | Pergunta | Quem decide | Até quando |
|---|---|---|---|
| 25.1 | ~~Nome do produto e domínio~~ **Respondida (03/11/2026):** domínio **`reuniao.app.br`** (comprado pelo Alexandre). Produção: `NEXT_PUBLIC_SITE_URL=https://reuniao.app.br`, remetente `agenda@reuniao.app.br` (domínio verificado no Resend), redirect do OAuth `https://reuniao.app.br/api/auth/google/callback`. Dev: `localhost:3020`, remetente de teste `onboarding@resend.dev`. Nome exibido do produto: **Reunião** (04/11/2026) | — | — |
| 25.2 | ~~Slug de cada conta~~ **Respondida:** Gmail pessoal → `alexandre`; BBZ → `alexandre-bbz`. **Atualizado em 06/11/2026:** em produção, `alexandre` ficou com a conta DabLab (`alexandre@dablab.com.br`) e a BBZ ficou com `asq` (decisão do Alexandre). O `seed:calendly` aceita `--slug` para gravar o endereço junto com os tipos | — | — |
| 25.3 | ~~Contato de privacidade~~ **Respondida:** o e-mail da própria conta (`ag_contas.email`) da página que o convidado está vendo | — | — |
| 25.4 | ~~App aberto~~ **Respondida (05/11/2026):** produto gratuito da DabLab, aberto de uma vez, só pt-BR; Google Cloud no projeto DabLab (guarda-chuva); controladora dos dados dos donos: DabLab, contato `alexandre@dablab.com.br`, foro São Paulo/SP. Plano em `plans/9.0-app-aberto.md` | — | — |

---

## 26. Definition of Done
- [ ] Todos os critérios de 8.0–8.9 cumpridos, com saída do `npm run verify` colada em cada épico e relatório do `verifier` sem "não cumprido".
- [ ] Banco em português `snake_case`, prefixo `ag_`, sem tabela ou coluna fora da seção 7.
- [ ] Todas as rotinas, rotas, triggers e funções comentadas com a regra que implementam.
- [ ] RLS ligado e sem acesso de `anon`/`authenticated` em todas as `ag_*` (pgTAP).
- [ ] Advisors security + performance rodados após o último DDL, sem alerta crítico em `ag_*`.
- [ ] Guardrails do Anexo B instalados em `.claude/` e cada hook testado uma vez.
- [ ] `plans/` com o plano aprovado de cada épico, consistente com o código (ou divergência registrada).
- [ ] `DOCUMENTACAO-TECNICA.md` gerado e conferido; `CLAUDE.md` (uma página) e README em dia.
- [ ] Google Cloud em "Em produção"; Resend com domínio verificado (SPF/DKIM); Vercel com domínio, variáveis e cron.
- [ ] Teste manual ponta a ponta com o Gmail pessoal: marcar, receber convite com Meet, remarcar, cancelar, e-mails do dono.
- [ ] Teste com `asq@bbz.com.br` concluído antes de cancelar o Calendly.
- [ ] Modo escuro e 375 px conferidos por screenshot em todas as telas da seção 10.

---

## 27. Próximos passos operacionais
1. Alexandre revisa as seções 24 e 25 (principalmente 24.4 e 25.1).
2. Criar o repositório `minha-agenda` no GitHub (privado) e ligar à Vercel.
3. Colar o prompt de implementação no Claude Code, a partir de `~/minha-agenda`.
4. Desenhar as telas no Claude Design com `prompt-design-minha-agenda.md` (pode correr junto com os épicos 8.0–8.4, que não dependem de tela).
5. Durante o 8.1: Alexandre cria o projeto no Google Cloud e o cliente OAuth seguindo o README (só cliques no console).
6. Antes do 8.5: domínio comprado, DNS apontado para a Vercel e verificado no Resend.
7. Usar uma semana com o Gmail pessoal; depois conta BBZ; cancelar o Calendly.

---

## 28. Roadmap: próximas releases
- **Várias agendas para conflito:** escopo `calendar.calendarlist.readonly`; coluna `agendas_consulta text[]` em `ag_conexoes_google`; tela de escolha em Conta; `freebusy` com todas as marcadas. Agenda de destino escolhível.
- **Sincronização com o Google:** `events.watch` (push) para detectar evento de reserva apagado/movido direto no Google e refletir em `ag_reservas` (`cancelada_dono`).
- **Lembrete por e-mail** 24 h antes (novo `ag_tipo_notificacao = lembrete_convidado`; cron horário exige Vercel Pro ou `pg_cron`).
- **Interface em inglês** (detecção pelo navegador; `copy.ts` com dois idiomas; e-mails no idioma da reserva).
- **Perguntas personalizadas** por tipo de evento (tabela `ag_perguntas` e respostas em jsonb na reserva).
- **Remarcar pelo dono** e **troca rápida entre contas** no menu.
- **Limite de reuniões** por dia/semana, por conta ou por tipo.
- **Turnstile** no formulário, se aparecer abuso.
- **Botão "apagar dados do convidado"** no detalhe da reunião.

---

## 29. Protocolo de mudanças incrementais
1. Commit de checkpoint antes de qualquer mudança.
2. Não colar o spec inteiro de novo: só o trecho novo/alterado ou um spec da feature.
3. Escrever como diff: "o app já existe e funciona; mude só X".
4. Dizer nominalmente o que **não** deve mudar.
5. Pedir o plano em plan mode (arquivos, ordem, testes que provam) e salvar em `plans/<feature>.md` antes do código. Bug: o plano começa pelo teste que reproduz.
6. Revisar o `git diff` contra o plano; reverter o que passou do escopo. Divergência necessária → atualizar o plano no mesmo commit.
7. Atualizar `DOCUMENTACAO-TECNICA.md` (e `CLAUDE.md`/README, se for o caso) no mesmo commit.

Modelo:
```
O app Reunião já está implementado e funcionando (spec.md v0.1, DOCUMENTACAO-TECNICA.md).
Quero mudar só isto: <descrição>.
Não mexa em: <telas/rotas/tabelas que não devem mudar>.
Entre em plan mode, me mostre o plano (arquivos, ordem, testes) e salve em plans/<feature>.md depois de aprovado.
Rode npm run verify, cole a saída, acione o verifier e atualize DOCUMENTACAO-TECNICA.md no mesmo commit.
```

---

## Anexo A — Fontes (consultadas em 03/11/2026)
- Google, *Using OAuth 2.0 to Access Google APIs* (expiração do refresh token: 7 dias em "Testing"; 6 meses sem uso; limite de 100 por conta/cliente): https://developers.google.com/identity/protocols/oauth2
- Google, *Choose Google Calendar API scopes* (`calendar.freebusy` não sensível; `calendar.events.owned` sensível): https://developers.google.com/workspace/calendar/api/auth
- Google Cloud Help, *When is verification not needed* (uso pessoal < 100 usuários, tela de app não verificado): https://support.google.com/cloud/answer/13464323
- Google, *Freebusy: query*: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Resend, *What is Resend pricing* (gratuito: 3.000/mês, 100/dia): https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Projeto de referência: `~/orcamento-casa/spec.md` (stack, seção 16, Anexo B).

---

## Anexo B — Kit de guardrails do Claude Code

### `.claude/settings.json`
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-secrets.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-migrations.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-tests.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/remind-advisors.sh" }
        ]
      }
    ]
  }
}
```

### `.claude/hooks/guard-secrets.sh`
```bash
#!/bin/bash
# Bloqueia segredo ou import de src/server/ em código que pode rodar no cliente.
# Implementa as seções 18 e 20: segredo só existe no servidor.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Rodam só no servidor: rotas de API, src/server, server.ts das features, scripts e o proxy.
case "$path" in
  */src/app/api/*|*/src/app/sair/*|*/src/server/*|*/src/features/*/server.ts|*/src/features/*/server/*|*/scripts/*|*/src/proxy.ts) exit 0 ;;
  */src/app/*|*/src/components/*|*/src/features/*|*/src/lib/*) ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -qE 'SUPABASE_SERVICE_ROLE_KEY|service_role|GOOGLE_CLIENT_SECRET|TOKEN_ENC_KEY|SESSION_SECRET|RESEND_API_KEY|CRON_SECRET|NEXT_PUBLIC_[A-Z_]*(SECRET|KEY)'; then
  echo "Bloqueado: segredo em código que pode rodar no cliente (seções 18 e 20). Leia o segredo só em src/server/ ou numa rota em src/app/api/ e chame essa rota do cliente." >&2
  exit 2
fi
# Arquivo com 'use client' nunca importa src/server.
if echo "$content" | grep -q "use client" && echo "$content" | grep -qE "from ['\"]@/server/|from ['\"](\.\./)+server/"; then
  echo "Bloqueado: componente de cliente importando src/server/ (seção 20). Exponha o dado por uma rota ou passe por props de um Server Component." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-migrations.sh`
```bash
#!/bin/bash
# Impede editar migration já versionada no git; mudança de schema vira migration nova (seção 7.6).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*) ;;
  *) exit 0 ;;
esac
rel="${path#"$CLAUDE_PROJECT_DIR"/}"
if git -C "$CLAUDE_PROJECT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
  echo "Bloqueado: $rel já está versionada. Não se edita migration aplicada; crie uma nova migration com a alteração (seção 7.6)." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-tests.sh`
```bash
#!/bin/bash
# Em correção de bug (arquivo .claude/fix-mode presente), impede editar testes para "fazer passar".
# Implementa a seção 22.1: bug se corrige no código, não no teste.
[ -f "$CLAUDE_PROJECT_DIR/.claude/fix-mode" ] || exit 0
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  *.test.ts|*.test.tsx|*.spec.ts|*/__tests__/*|*/tests/*|*/supabase/tests/*)
    echo "Bloqueado: modo de correção ativo (.claude/fix-mode). Corrija o código, não o teste (seção 22.1). Se o teste estiver errado de fato, pare e explique ao humano." >&2
    exit 2 ;;
esac
exit 0
```
Uso: `touch .claude/fix-mode` depois de commitar o teste que reproduz o bug; `rm .claude/fix-mode` ao terminar. `.claude/fix-mode` vai no `.gitignore`.

### `.claude/hooks/remind-advisors.sh`
```bash
#!/bin/bash
# Depois de escrever uma migration, lembra de aplicar pelo MCP, rodar os advisors e regenerar o schema (seções 7.6 e 20).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*)
    echo "Migration escrita. Aplique no local e no remoto (MCP apply_migration, mesmo SQL; nunca db push), rode get_advisors (security e performance) filtrando objetos ag_*, resolva alertas críticos e regenere supabase/schema.sql filtrado a ag_ (seções 7.6 e 20)." >&2
    exit 2 ;;
esac
exit 0
```

### `.claude/agents/verifier.md`
```markdown
---
name: verifier
description: Confere em contexto limpo se o épico implementado cumpre os critérios de aceite do spec.md. Use ao terminar cada épico, antes de declarar pronto.
tools: Bash, Read, Grep
---
Você verifica; não corrige nada.

1. Leia no spec.md a seção 8.X do épico indicado, a matriz de permissões (seção 5), a seção 6, as regras da seção 11 e a máquina de estado (seção 12) que o épico toca.
2. Leia o plano em plans/ correspondente e o git diff do épico.
3. Rode `npm run verify` e guarde a saída.
4. Para cada critério de aceite: cumprido / não cumprido / não verificável — com evidência (saída de comando ou arquivo:linha).
5. Para cada rota nova: a primeira linha chama requireConta() (painel) ou requireReservaPorToken() (gestão)? Toda consulta ao banco filtra por conta_id ou token_hash?
6. Confira que nenhum caminho oferece horário quando o Google falha ou a conexão está revogada (princípio 2), e que fim da reserva é calculado no servidor.
7. Confira que nenhum log registra e-mail, nome, observação, token ou URL /r/ (seção 20).
8. Liste divergências entre o diff e o plano.

Termine com uma linha: PRONTO ou NÃO PRONTO, e os itens que impedem.
```

### `REVIEW.md`
```markdown
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
```
