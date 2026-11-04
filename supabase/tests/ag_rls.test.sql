-- Seção 6 / critério 8.1: todas as ag_* com RLS ligado, sem política, e sem nenhum privilégio
-- para anon/authenticated (o banco só é usado pelo servidor com service role).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select ok(c.relrowsecurity, 'RLS ligado em ' || c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname in (
  'ag_contas','ag_conexoes_google','ag_tipos_evento','ag_horarios_semanais','ag_excecoes_data','ag_reservas','ag_notificacoes'
) order by c.relname;

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename like 'ag\_%'),
  0, 'nenhuma política nas tabelas ag_*'
);

select ok(not has_table_privilege(r, 'public.' || t, p), r || ' sem ' || p || ' em ' || t)
from unnest(array['ag_contas','ag_conexoes_google','ag_tipos_evento','ag_horarios_semanais','ag_excecoes_data','ag_reservas','ag_notificacoes']) t,
     unnest(array['anon','authenticated']) r,
     unnest(array['select','insert']) p
where p = 'select' or r = 'anon'
order by t, r, p;

select ok(not has_function_privilege('anon', 'public.ag_fn_remarcar_reservar(uuid,timestamptz,timestamptz,text,text)', 'execute'),
  'anon não executa ag_fn_remarcar_reservar');
select ok(not has_function_privilege('authenticated', 'public.ag_fn_substitui_horarios(uuid,jsonb)', 'execute'),
  'authenticated não executa ag_fn_substitui_horarios');

-- Como anon, selecionar falha com permissão negada.
set local role anon;
select throws_ok('select * from public.ag_reservas', '42501', null, 'anon recebe permission denied em ag_reservas');
reset role;

select * from finish();
rollback;
