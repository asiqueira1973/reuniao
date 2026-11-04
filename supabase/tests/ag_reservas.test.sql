-- Seção 7.3 / princípio 2: constraint ag_reservas_sem_sobreposicao e remarcação (seção 12).
-- Usa só dados próprios da fixture (o banco local pode ter dados de outros testes).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.ag_contas (id, google_sub, email, nome_exibicao, slug)
values ('00000000-0000-4000-8000-0000000000a1', 'sub-teste-reservas', 'dono@teste.dev', 'Dono Teste', 'teste-reservas-fixture');
insert into public.ag_tipos_evento (id, conta_id, nome, slug, duracao_min)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'Reunião de 1h', 'reuniao-1h', 60);

-- Reserva base: 2030-01-07 15:00–16:00 UTC, confirmada.
insert into public.ag_reservas (id, conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, fuso_convidado, status, token_hash)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1',
        '2030-01-07 15:00+00', '2030-01-07 16:00+00', 'Ana', 'ana@teste.dev', 'America/Sao_Paulo', 'confirmada', 'hash-c1');

select throws_ok($$
  insert into public.ag_reservas (conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, fuso_convidado, token_hash)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '2030-01-07 15:30+00', '2030-01-07 16:30+00', 'Bia', 'bia@teste.dev', 'America/Sao_Paulo', 'hash-x1')
$$, '23P01', null, 'reserva processando sobreposta a uma confirmada é recusada');

select lives_ok($$
  insert into public.ag_reservas (conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, fuso_convidado, token_hash)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '2030-01-07 16:00+00', '2030-01-07 17:00+00', 'Bia', 'bia@teste.dev', 'America/Sao_Paulo', 'hash-x2')
$$, 'reserva que só encosta ([) ) é aceita');

select lives_ok($$
  insert into public.ag_reservas (conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, fuso_convidado, status, token_hash)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '2030-01-07 15:00+00', '2030-01-07 16:00+00', 'Caio', 'caio@teste.dev', 'America/Sao_Paulo', 'falhou', 'hash-x3')
$$, 'reserva falhou no mesmo horário não bloqueia');

select throws_ok($$
  insert into public.ag_reservas (conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, fuso_convidado, token_hash)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '2030-01-07 15:00+00', '2030-01-07 15:00+00', 'Dani', 'dani@teste.dev', 'America/Sao_Paulo', 'hash-x4')
$$, '23514', null, 'fim igual ao início é recusado');

-- Remarcar adiando 30 min (cruza o próprio horário antigo): permitido.
select lives_ok($$
  select public.ag_fn_remarcar_reservar('00000000-0000-4000-8000-0000000000c1', '2030-01-07 14:30+00', '2030-01-07 15:30+00', 'hash-novo-1', 'America/Sao_Paulo')
$$, 'remarcar para horário que cruza o antigo funciona');
select is((select status::text from public.ag_reservas where id = '00000000-0000-4000-8000-0000000000c1'), 'remarcada', 'antiga fica remarcada');
select is((select status::text from public.ag_reservas where token_hash = 'hash-novo-1'), 'processando', 'nova nasce processando');
select is((select remarcada_de_id from public.ag_reservas where token_hash = 'hash-novo-1'), '00000000-0000-4000-8000-0000000000c1'::uuid, 'nova aponta para a antiga');

-- Desfazer: nova vira falhou, antiga volta a confirmada.
select is(public.ag_fn_desfaz_remarcacao((select id from public.ag_reservas where token_hash = 'hash-novo-1')), 'restaurada', 'desfazer restaura a antiga');
select is((select status::text from public.ag_reservas where id = '00000000-0000-4000-8000-0000000000c1'), 'confirmada', 'antiga volta a confirmada');

-- Remarcar reserva que não está confirmada: recusado.
select throws_ok($$
  select public.ag_fn_remarcar_reservar((select id from public.ag_reservas where token_hash = 'hash-x3'), '2030-01-08 15:00+00', '2030-01-08 16:00+00', 'hash-novo-2', 'America/Sao_Paulo')
$$, 'P0001', 'transicao_invalida', 'remarcar reserva falhou é transição inválida');

-- Desfazer quando alguém pegou o horário antigo: antiga fica remarcada ('perdida').
select public.ag_fn_remarcar_reservar('00000000-0000-4000-8000-0000000000c1', '2030-01-09 15:00+00', '2030-01-09 16:00+00', 'hash-novo-3', 'America/Sao_Paulo');
insert into public.ag_reservas (conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, fuso_convidado, token_hash)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '2030-01-07 15:00+00', '2030-01-07 16:00+00', 'Eva', 'eva@teste.dev', 'America/Sao_Paulo', 'hash-x5');
select is(public.ag_fn_desfaz_remarcacao((select id from public.ag_reservas where token_hash = 'hash-novo-3')), 'perdida', 'desfazer com horário antigo tomado devolve perdida');

select * from finish();
rollback;
