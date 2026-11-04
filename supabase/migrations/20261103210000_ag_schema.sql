-- Minha Agenda — schema (spec.md v0.2, seções 7.2, 7.3 e 6).
-- Cria enums e tabelas com prefixo ag_ (projeto Supabase compartilhado), checks, índices e a
-- constraint que impede duas reservas ativas sobrepostas (princípio 2). Liga RLS sem nenhuma
-- política e revoga o acesso de anon/authenticated: o banco só é usado pelo servidor (seção 6).
-- Só toca objetos ag_*; nada de outros apps do projeto.

create extension if not exists btree_gist with schema extensions;

-- 7.2 Enums -------------------------------------------------------------------------------

-- Situação da conexão com o Google: ativa ou recusada pelo Google (invalid_grant).
create type public.ag_status_conexao as enum ('ativa', 'revogada');

-- Ciclo de vida da reserva (seção 12).
create type public.ag_status_reserva as enum (
  'processando', 'confirmada', 'cancelada_convidado', 'cancelada_dono', 'remarcada', 'falhou'
);

-- Data específica: dia inteiro bloqueado ou faixas próprias no lugar das semanais.
create type public.ag_tipo_excecao as enum ('indisponivel', 'horario_especial');

-- Qual e-mail (regra 11.6).
create type public.ag_tipo_notificacao as enum (
  'confirmacao_convidado', 'aviso_dono_nova', 'aviso_dono_remarcada', 'aviso_dono_cancelada',
  'cancelamento_convidado', 'reconectar_google'
);

-- Situação do envio pelo Resend.
create type public.ag_status_notificacao as enum ('pendente', 'enviada', 'falhou');

-- 7.3 Tabelas -----------------------------------------------------------------------------

-- Uma conta por e-mail Google do dono (seção 5). Hard delete com cascata (7.4).
create table public.ag_contas (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  nome_exibicao text not null,
  slug text not null unique,
  mensagem_boas_vindas text,
  fuso text not null default 'America/Sao_Paulo',
  feriados_ativos boolean not null default true,
  feriados_desligados text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Regra 11.11: formato do endereço público e lista reservada.
  constraint ag_contas_slug_ck check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'),
  constraint ag_contas_slug_reservado_ck check (slug not in (
    'painel', 'entrar', 'sair', 'api', 'r', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml',
    'ajuda', 'termos', 'privacidade'
  )),
  constraint ag_contas_nome_ck check (char_length(nome_exibicao) between 1 and 100),
  constraint ag_contas_mensagem_ck check (mensagem_boas_vindas is null or char_length(mensagem_boas_vindas) <= 300)
);

-- Segredo da conexão Google (refresh token cifrado, regra 11.10); nunca sai do servidor.
create table public.ag_conexoes_google (
  conta_id uuid primary key references public.ag_contas (id) on delete cascade,
  refresh_token_cifrado text not null,
  escopos text[] not null,
  status public.ag_status_conexao not null default 'ativa',
  revogada_em timestamptz,
  aviso_reconectar_enviado boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- Tipos de reunião. Soft delete por excluido_em (7.4).
create table public.ag_tipos_evento (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao text,
  duracao_min integer not null default 30,
  com_meet boolean not null default true,
  antecedencia_min integer not null default 240,
  janela_dias integer not null default 60,
  intervalo_antes_min integer not null default 0,
  intervalo_depois_min integer not null default 0,
  passo_min integer not null default 30,
  visivel_na_pagina boolean not null default true,
  ativo boolean not null default true,
  ordem integer not null default 0,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ag_tipos_evento_nome_ck check (char_length(nome) between 1 and 60),
  constraint ag_tipos_evento_slug_ck check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'),
  constraint ag_tipos_evento_descricao_ck check (descricao is null or char_length(descricao) <= 1000),
  constraint ag_tipos_evento_duracao_ck check (duracao_min between 15 and 240 and duracao_min % 5 = 0),
  constraint ag_tipos_evento_antecedencia_ck check (antecedencia_min between 0 and 10080),
  constraint ag_tipos_evento_janela_ck check (janela_dias between 1 and 365),
  constraint ag_tipos_evento_intervalos_ck check (
    intervalo_antes_min between 0 and 120 and intervalo_depois_min between 0 and 120
  ),
  constraint ag_tipos_evento_passo_ck check (passo_min in (10, 15, 20, 30, 45, 60, 90, 120))
);

-- Slug único por conta entre os tipos não excluídos.
create unique index ag_tipos_evento_slug_uk on public.ag_tipos_evento (conta_id, slug)
  where excluido_em is null;

-- Faixas semanais recorrentes (0 = domingo … 6 = sábado), no fuso da conta.
create table public.ag_horarios_semanais (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  dia_semana smallint not null,
  inicio time not null,
  fim time not null,
  constraint ag_horarios_semanais_dia_ck check (dia_semana between 0 and 6),
  constraint ag_horarios_semanais_faixa_ck check (fim > inicio),
  constraint ag_horarios_semanais_multiplo_ck check (
    extract(minute from inicio)::int % 5 = 0 and extract(second from inicio) = 0
    and extract(minute from fim)::int % 5 = 0 and extract(second from fim) = 0
  )
);
create index ag_horarios_semanais_conta_idx on public.ag_horarios_semanais (conta_id, dia_semana);

-- Datas específicas: dia indisponível ou faixas próprias naquela data.
create table public.ag_excecoes_data (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  data date not null,
  tipo public.ag_tipo_excecao not null,
  inicio time,
  fim time,
  constraint ag_excecoes_data_tipo_ck check (
    (tipo = 'indisponivel' and inicio is null and fim is null)
    or (tipo = 'horario_especial' and inicio is not null and fim is not null and fim > inicio)
  )
);
create index ag_excecoes_data_conta_idx on public.ag_excecoes_data (conta_id, data);

-- Reservas feitas pelos convidados. Nunca apagadas; anonimizadas após 24 meses (11.12).
create table public.ag_reservas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  tipo_evento_id uuid not null references public.ag_tipos_evento (id) on delete restrict,
  inicio timestamptz not null,
  fim timestamptz not null,
  nome_convidado text not null,
  email_convidado text not null,
  observacao text,
  fuso_convidado text not null,
  status public.ag_status_reserva not null default 'processando',
  google_evento_id text,
  link_meet text,
  token_hash text not null unique,
  remarcada_de_id uuid references public.ag_reservas (id),
  motivo_cancelamento text,
  cancelada_em timestamptz,
  dados_anonimizados_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ag_reservas_faixa_ck check (fim > inicio),
  constraint ag_reservas_nome_ck check (char_length(nome_convidado) between 1 and 100),
  constraint ag_reservas_email_ck check (email_convidado = lower(email_convidado) and email_convidado like '%_@_%'),
  constraint ag_reservas_observacao_ck check (observacao is null or char_length(observacao) <= 1000),
  constraint ag_reservas_motivo_ck check (motivo_cancelamento is null or char_length(motivo_cancelamento) <= 500),
  -- Princípio 2 / seção 7.3: duas reservas ativas da mesma conta nunca se sobrepõem.
  -- Intervalo meio-aberto [inicio, fim): encostar não é sobrepor.
  constraint ag_reservas_sem_sobreposicao exclude using gist (
    conta_id extensions.gist_uuid_ops with =,
    tstzrange(inicio, fim, '[)') with &&
  ) where (status in ('processando', 'confirmada'))
);
create index ag_reservas_conta_inicio_idx on public.ag_reservas (conta_id, inicio);
create index ag_reservas_email_conta_idx on public.ag_reservas (email_convidado, conta_id);
create index ag_reservas_tipo_idx on public.ag_reservas (tipo_evento_id);
create index ag_reservas_remarcada_de_idx on public.ag_reservas (remarcada_de_id);

-- Registro de cada e-mail, para reenvio e idempotência (regra 11.6).
create table public.ag_notificacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  reserva_id uuid references public.ag_reservas (id) on delete cascade,
  tipo public.ag_tipo_notificacao not null,
  status public.ag_status_notificacao not null default 'pendente',
  tentativas smallint not null default 0,
  resend_id text,
  erro text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz,
  constraint ag_notificacoes_tentativas_ck check (tentativas between 0 and 5),
  constraint ag_notificacoes_reserva_ck check (reserva_id is not null or tipo = 'reconectar_google')
);
-- O mesmo e-mail nunca sai duas vezes para a mesma reserva.
create unique index ag_notificacoes_uk on public.ag_notificacoes (reserva_id, tipo);
create index ag_notificacoes_conta_idx on public.ag_notificacoes (conta_id);
create index ag_notificacoes_pendentes_idx on public.ag_notificacoes (status) where status <> 'enviada';

-- Seção 6: RLS ligado e nenhuma política; nada para anon/authenticated -------------------
alter table public.ag_contas enable row level security;
alter table public.ag_conexoes_google enable row level security;
alter table public.ag_tipos_evento enable row level security;
alter table public.ag_horarios_semanais enable row level security;
alter table public.ag_excecoes_data enable row level security;
alter table public.ag_reservas enable row level security;
alter table public.ag_notificacoes enable row level security;

revoke all on table
  public.ag_contas, public.ag_conexoes_google, public.ag_tipos_evento, public.ag_horarios_semanais,
  public.ag_excecoes_data, public.ag_reservas, public.ag_notificacoes
from anon, authenticated, public;

grant select, insert, update, delete on table
  public.ag_contas, public.ag_conexoes_google, public.ag_tipos_evento, public.ag_horarios_semanais,
  public.ag_excecoes_data, public.ag_reservas, public.ag_notificacoes
to service_role;
