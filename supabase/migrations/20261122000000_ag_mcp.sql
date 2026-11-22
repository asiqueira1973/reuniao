-- Reunião — plano 9.6: servidor MCP com OAuth 2.1 próprio (desenho do Assina).
-- Cliente público registrado sozinho (RFC 7591), código de autorização de 10 min com PKCE S256 e
-- troca por um token `reuniao_mcp_…` que só existe como hash e vale até ser revogado em Conta.
-- RLS ligado e sem política, como o resto: só o servidor (service_role) acessa.

-- ag_oauth_clientes: cada assistente que se registrou (Claude, ChatGPT…). nome = o que o cliente
-- disse de si; redirect_uris = de 1 a 5 endereços de volta aceitos.
create table public.ag_oauth_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 100),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 5),
  criado_em timestamptz not null default now()
);

-- ag_mcp_tokens: conexão de um assistente a uma conta. Só o hash do token fica guardado; prefixo
-- ajuda a reconhecer na tela. revogado_em preenchido = conexão desfeita (Conta → Assistentes).
create table public.ag_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  cliente_id uuid references public.ag_oauth_clientes (id) on delete set null,
  nome text not null,
  token_hash text not null unique,
  prefixo text not null,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  revogado_em timestamptz
);
create index ag_mcp_tokens_conta_idx on public.ag_mcp_tokens (conta_id);
create index ag_mcp_tokens_cliente_idx on public.ag_mcp_tokens (cliente_id);

-- ag_oauth_codigos: código de autorização (hash), de um cliente para uma conta, com o redirect_uri
-- e o code_challenge do PKCE. usado_em preenchido = já trocado; token_id = o token que ele gerou
-- (reuso do código revoga esse token, RFC 9700).
create table public.ag_oauth_codigos (
  codigo_hash text primary key,
  cliente_id uuid not null references public.ag_oauth_clientes (id) on delete cascade,
  conta_id uuid not null references public.ag_contas (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  expira_em timestamptz not null,
  usado_em timestamptz,
  token_id uuid references public.ag_mcp_tokens (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index ag_oauth_codigos_cliente_idx on public.ag_oauth_codigos (cliente_id);
create index ag_oauth_codigos_conta_idx on public.ag_oauth_codigos (conta_id);
create index ag_oauth_codigos_token_idx on public.ag_oauth_codigos (token_id);

alter table public.ag_oauth_clientes enable row level security;
alter table public.ag_mcp_tokens enable row level security;
alter table public.ag_oauth_codigos enable row level security;
revoke all on public.ag_oauth_clientes, public.ag_mcp_tokens, public.ag_oauth_codigos from anon, authenticated;
grant select, insert, update, delete on public.ag_oauth_clientes, public.ag_mcp_tokens, public.ag_oauth_codigos to service_role;

-- O endereço /mcp e o caminho /oauth agora são rotas do app: não podem virar endereço de conta.
alter table public.ag_contas drop constraint ag_contas_slug_reservado_ck;
alter table public.ag_contas add constraint ag_contas_slug_reservado_ck check (slug <> all (array[
  'painel', 'entrar', 'sair', 'api', 'r', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml',
  'ajuda', 'termos', 'privacidade', 'mcp', 'oauth'
]));

-- ---------------------------------------------------------------------------------------------
-- ag_fn_cria_codigo_oauth: "Permitir" na tela de consentimento. Confere que o redirect_uri é
-- exatamente um dos registrados pelo cliente e grava o código (hash) com validade em segundos.
-- Recebe: hash do código, cliente, conta, redirect_uri, code_challenge e validade.
-- Lança: 'invalid_client' (cliente não existe) ou 'invalid_request' (redirect ou challenge ruins).
-- ---------------------------------------------------------------------------------------------
create function public.ag_fn_cria_codigo_oauth(
  p_codigo_hash text, p_cliente_id uuid, p_conta_id uuid, p_redirect_uri text, p_code_challenge text, p_validade_s integer
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_uris text[];
begin
  select redirect_uris into v_uris from public.ag_oauth_clientes where id = p_cliente_id;
  if v_uris is null then
    raise exception 'invalid_client';
  end if;
  if not (p_redirect_uri = any (v_uris)) or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_request';
  end if;
  insert into public.ag_oauth_codigos (codigo_hash, cliente_id, conta_id, redirect_uri, code_challenge, expira_em)
  values (p_codigo_hash, p_cliente_id, p_conta_id, p_redirect_uri, p_code_challenge, now() + make_interval(secs => p_validade_s));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- ag_fn_troca_codigo_oauth: POST /oauth/token, com o código travado (duas trocas ao mesmo tempo
-- não geram dois tokens). Confere: existe, não usado, não vencido, mesmo cliente, mesmo
-- redirect_uri e PKCE (o servidor manda o S256 do verifier). Conta suspensa não recebe token.
-- Queima o código e cria o token com o nome do cliente. Código já usado: revoga o token que ele
-- gerou e não emite outro. Não lança: devolve nulo quando não vale (invalid_grant), para a
-- revogação do reuso ficar gravada.
-- Recebe: hash do código, cliente, redirect_uri, S256 do verifier, hash e prefixo do token.
-- Devolve: a conta, ou nulo.
-- ---------------------------------------------------------------------------------------------
create function public.ag_fn_troca_codigo_oauth(
  p_codigo_hash text, p_cliente_id uuid, p_redirect_uri text, p_challenge_do_verifier text, p_token_hash text, p_token_prefixo text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_c public.ag_oauth_codigos;
  v_nome text;
  v_token uuid;
begin
  select * into v_c from public.ag_oauth_codigos where codigo_hash = p_codigo_hash for update;
  if v_c.codigo_hash is null then
    return null;
  end if;
  if v_c.usado_em is not null then
    update public.ag_mcp_tokens set revogado_em = now() where id = v_c.token_id and revogado_em is null;
    return null;
  end if;
  if v_c.expira_em <= now()
     or v_c.cliente_id <> p_cliente_id
     or v_c.redirect_uri is distinct from p_redirect_uri
     or v_c.code_challenge is distinct from p_challenge_do_verifier then
    return null;
  end if;
  if exists (select 1 from public.ag_contas where id = v_c.conta_id and suspensa_em is not null) then
    return null;
  end if;
  select nome into v_nome from public.ag_oauth_clientes where id = p_cliente_id;
  insert into public.ag_mcp_tokens (conta_id, cliente_id, nome, token_hash, prefixo)
  values (v_c.conta_id, p_cliente_id, coalesce(v_nome, 'Assistente'), p_token_hash, p_token_prefixo)
  returning id into v_token;
  update public.ag_oauth_codigos set usado_em = now(), token_id = v_token where codigo_hash = p_codigo_hash;
  return v_c.conta_id;
end;
$$;

revoke all on function
  public.ag_fn_cria_codigo_oauth(text, uuid, uuid, text, text, integer),
  public.ag_fn_troca_codigo_oauth(text, uuid, text, text, text, text)
from public, anon, authenticated;
grant execute on function
  public.ag_fn_cria_codigo_oauth(text, uuid, uuid, text, text, integer),
  public.ag_fn_troca_codigo_oauth(text, uuid, text, text, text, text)
to service_role;
