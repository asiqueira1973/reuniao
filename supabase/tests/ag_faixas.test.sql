-- Seção 7.5: ag_fn_valida_faixas e funções de substituição de faixas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.ag_contas (id, google_sub, email, nome_exibicao, slug)
values ('00000000-0000-4000-8000-0000000000a2', 'sub-teste-faixas', 'dono2@teste.dev', 'Dono Teste', 'teste-faixas-fixture');

select lives_ok($$ select public.ag_fn_substitui_horarios('00000000-0000-4000-8000-0000000000a2',
  '[{"dia_semana":1,"inicio":"10:30","fim":"12:00"},{"dia_semana":1,"inicio":"14:30","fim":"18:00"}]') $$,
  'duas faixas sem sobreposição são aceitas');
select is((select count(*)::int from public.ag_horarios_semanais where conta_id = '00000000-0000-4000-8000-0000000000a2'), 2, 'duas faixas gravadas');

select throws_ok($$ select public.ag_fn_substitui_horarios('00000000-0000-4000-8000-0000000000a2',
  '[{"dia_semana":1,"inicio":"10:30","fim":"12:00"},{"dia_semana":1,"inicio":"11:30","fim":"13:00"}]') $$,
  'P0001', 'faixa_sobreposta', 'faixas sobrepostas são recusadas');

select lives_ok($$ select public.ag_fn_substitui_horarios('00000000-0000-4000-8000-0000000000a2',
  '[{"dia_semana":2,"inicio":"10:00","fim":"12:00"},{"dia_semana":2,"inicio":"12:00","fim":"13:00"}]') $$,
  'faixas que só encostam são aceitas');

select throws_ok($$ insert into public.ag_horarios_semanais (conta_id, dia_semana, inicio, fim)
  values ('00000000-0000-4000-8000-0000000000a2', 3, '10:07', '11:00') $$, '23514', null, 'horário fora do múltiplo de 5 é recusado');

select lives_ok($$ select public.ag_fn_substitui_excecoes_data('00000000-0000-4000-8000-0000000000a2', '2030-02-01', 'indisponivel', '[]') $$,
  'data indisponível gravada');
select throws_ok($$ insert into public.ag_excecoes_data (conta_id, data, tipo, inicio, fim)
  values ('00000000-0000-4000-8000-0000000000a2', '2030-02-01', 'horario_especial', '10:00', '11:00') $$,
  'P0001', 'excecao_conflitante', 'misturar indisponível e horário especial na mesma data é recusado');
select throws_ok($$ insert into public.ag_excecoes_data (conta_id, data, tipo)
  values ('00000000-0000-4000-8000-0000000000a2', '2030-02-02', 'horario_especial') $$,
  '23514', null, 'horário especial sem faixa é recusado');

select * from finish();
rollback;
