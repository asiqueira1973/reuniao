-- Minha Agenda — lógica no banco (spec.md v0.2, seção 7.5 e seção 12).
-- Triggers e funções com prefixo ag_, todas SECURITY INVOKER e search_path vazio.
-- Erros de negócio sobem com MESSAGE = código (faixa_sobreposta, excecao_conflitante…);
-- o servidor traduz pelo dicionário de copy.

-- ag_tg_atualizado_em: grava now() em atualizado_em a cada UPDATE (7.5).
-- Recebe: a linha nova. Devolve: a linha com atualizado_em atualizado.
create function public.ag_tg_atualizado_em()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger ag_tg_atualizado_em before update on public.ag_contas
  for each row execute function public.ag_tg_atualizado_em();
create trigger ag_tg_atualizado_em before update on public.ag_conexoes_google
  for each row execute function public.ag_tg_atualizado_em();
create trigger ag_tg_atualizado_em before update on public.ag_tipos_evento
  for each row execute function public.ag_tg_atualizado_em();
create trigger ag_tg_atualizado_em before update on public.ag_reservas
  for each row execute function public.ag_tg_atualizado_em();

-- ag_fn_valida_faixas: impede faixas sobrepostas no mesmo dia (ag_horarios_semanais) ou na
-- mesma data (ag_excecoes_data) da mesma conta, e impede misturar 'indisponivel' com
-- 'horario_especial' numa data (7.5). Encostar (12:00 e 12:00) não é sobrepor.
-- Recebe: a linha nova. Devolve: a linha, ou erro faixa_sobreposta / excecao_conflitante.
create function public.ag_fn_valida_faixas()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'ag_horarios_semanais' then
    if exists (
      select 1 from public.ag_horarios_semanais h
      where h.conta_id = new.conta_id and h.dia_semana = new.dia_semana and h.id <> new.id
        and h.inicio < new.fim and new.inicio < h.fim
    ) then
      raise exception 'faixa_sobreposta';
    end if;
    return new;
  end if;

  -- ag_excecoes_data
  if new.tipo = 'indisponivel' then
    if exists (
      select 1 from public.ag_excecoes_data e
      where e.conta_id = new.conta_id and e.data = new.data and e.id <> new.id
    ) then
      raise exception 'excecao_conflitante';
    end if;
  else
    if exists (
      select 1 from public.ag_excecoes_data e
      where e.conta_id = new.conta_id and e.data = new.data and e.id <> new.id
        and e.tipo = 'indisponivel'
    ) then
      raise exception 'excecao_conflitante';
    end if;
    if exists (
      select 1 from public.ag_excecoes_data e
      where e.conta_id = new.conta_id and e.data = new.data and e.id <> new.id
        and e.tipo = 'horario_especial' and e.inicio < new.fim and new.inicio < e.fim
    ) then
      raise exception 'faixa_sobreposta';
    end if;
  end if;
  return new;
end;
$$;

create trigger ag_fn_valida_faixas before insert or update on public.ag_horarios_semanais
  for each row execute function public.ag_fn_valida_faixas();
create trigger ag_fn_valida_faixas before insert or update on public.ag_excecoes_data
  for each row execute function public.ag_fn_valida_faixas();

-- ag_fn_substitui_horarios: troca todas as faixas semanais da conta numa transação (a tela de
-- Disponibilidade salva o bloco inteiro de uma vez, épico 8.3).
-- Recebe: p_conta_id e p_faixas = [{"dia_semana":1,"inicio":"10:30","fim":"12:00"}, …].
-- Devolve: nada; erro faixa_sobreposta se o conjunto novo tiver sobreposição.
create function public.ag_fn_substitui_horarios(p_conta_id uuid, p_faixas jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serializa edições da mesma conta para a validação do trigger enxergar um estado estável.
  perform pg_advisory_xact_lock(hashtextextended('ag_horarios:' || p_conta_id::text, 0));
  delete from public.ag_horarios_semanais where conta_id = p_conta_id;
  insert into public.ag_horarios_semanais (conta_id, dia_semana, inicio, fim)
  select p_conta_id, (f ->> 'dia_semana')::smallint, (f ->> 'inicio')::time, (f ->> 'fim')::time
  from jsonb_array_elements(coalesce(p_faixas, '[]'::jsonb)) as f;
end;
$$;

-- ag_fn_substitui_excecoes_data: troca as exceções de uma data (épico 8.3).
-- Recebe: p_conta_id, p_data, p_tipo e p_faixas ([{"inicio","fim"}], vazio se indisponivel).
-- Devolve: nada; erros faixa_sobreposta / excecao_conflitante vindos do trigger.
create function public.ag_fn_substitui_excecoes_data(
  p_conta_id uuid, p_data date, p_tipo public.ag_tipo_excecao, p_faixas jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ag_excecoes:' || p_conta_id::text, 0));
  delete from public.ag_excecoes_data where conta_id = p_conta_id and data = p_data;
  if p_tipo = 'indisponivel' then
    insert into public.ag_excecoes_data (conta_id, data, tipo) values (p_conta_id, p_data, 'indisponivel');
  else
    insert into public.ag_excecoes_data (conta_id, data, tipo, inicio, fim)
    select p_conta_id, p_data, 'horario_especial', (f ->> 'inicio')::time, (f ->> 'fim')::time
    from jsonb_array_elements(coalesce(p_faixas, '[]'::jsonb)) as f;
  end if;
end;
$$;

-- ag_fn_remarcar_reservar: passo 1 da remarcação (seção 12). Numa transação, trava a reserva
-- antiga, confere que está confirmada e ainda não começou, marca-a 'remarcada' e insere a nova
-- em 'processando' com o mesmo evento do Google. Como a antiga já saiu do conjunto ativo, a
-- constraint ag_reservas_sem_sobreposicao compara a nova só com as outras reservas — permite
-- adiar 30 min uma reunião de 1 h.
-- Recebe: id da antiga, novo início/fim (fim calculado no servidor), hash do token novo e fuso.
-- Devolve: id da reserva nova. Erros: nao_encontrado, transicao_invalida, reuniao_iniciada;
-- sobreposição sobe como SQLSTATE 23P01 (o servidor traduz para horario_indisponivel).
create function public.ag_fn_remarcar_reservar(
  p_antiga_id uuid, p_inicio timestamptz, p_fim timestamptz, p_token_hash text, p_fuso text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_antiga public.ag_reservas%rowtype;
  v_nova_id uuid;
begin
  select * into v_antiga from public.ag_reservas where id = p_antiga_id for update;
  if not found then
    raise exception 'nao_encontrado';
  end if;
  if v_antiga.status <> 'confirmada' then
    raise exception 'transicao_invalida';
  end if;
  if v_antiga.inicio <= now() then
    raise exception 'reuniao_iniciada';
  end if;

  update public.ag_reservas set status = 'remarcada' where id = p_antiga_id;

  insert into public.ag_reservas (
    conta_id, tipo_evento_id, inicio, fim, nome_convidado, email_convidado, observacao,
    fuso_convidado, status, google_evento_id, link_meet, token_hash, remarcada_de_id
  ) values (
    v_antiga.conta_id, v_antiga.tipo_evento_id, p_inicio, p_fim, v_antiga.nome_convidado,
    v_antiga.email_convidado, v_antiga.observacao, p_fuso, 'processando',
    v_antiga.google_evento_id, v_antiga.link_meet, p_token_hash, p_antiga_id
  )
  returning id into v_nova_id;

  return v_nova_id;
end;
$$;

-- ag_fn_desfaz_remarcacao: passo 3 em caso de falha do patch no Google (seção 12). Marca a nova
-- como 'falhou' e tenta devolver a antiga a 'confirmada' (única transição remarcada → confirmada).
-- Se alguém pegou o horário antigo nesse meio-tempo, a antiga fica 'remarcada'.
-- Recebe: id da reserva nova. Devolve: 'restaurada' ou 'perdida' (o servidor avisa o dono).
create function public.ag_fn_desfaz_remarcacao(p_nova_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_antiga_id uuid;
begin
  update public.ag_reservas set status = 'falhou'
  where id = p_nova_id and status = 'processando'
  returning remarcada_de_id into v_antiga_id;
  if v_antiga_id is null then
    raise exception 'transicao_invalida';
  end if;

  begin
    update public.ag_reservas set status = 'confirmada'
    where id = v_antiga_id and status = 'remarcada';
    return 'restaurada';
  exception when exclusion_violation then
    return 'perdida';
  end;
end;
$$;

-- Só o servidor (service_role) executa as funções.
revoke all on function public.ag_fn_substitui_horarios(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ag_fn_substitui_excecoes_data(uuid, date, public.ag_tipo_excecao, jsonb) from public, anon, authenticated;
revoke all on function public.ag_fn_remarcar_reservar(uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.ag_fn_desfaz_remarcacao(uuid) from public, anon, authenticated;
revoke all on function public.ag_tg_atualizado_em() from public, anon, authenticated;
revoke all on function public.ag_fn_valida_faixas() from public, anon, authenticated;
grant execute on function public.ag_fn_substitui_horarios(uuid, jsonb) to service_role;
grant execute on function public.ag_fn_substitui_excecoes_data(uuid, date, public.ag_tipo_excecao, jsonb) to service_role;
grant execute on function public.ag_fn_remarcar_reservar(uuid, timestamptz, timestamptz, text, text) to service_role;
grant execute on function public.ag_fn_desfaz_remarcacao(uuid) to service_role;
