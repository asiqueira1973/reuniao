


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."ag_status_conexao" AS ENUM (
    'ativa',
    'revogada'
);


ALTER TYPE "public"."ag_status_conexao" OWNER TO "postgres";


CREATE TYPE "public"."ag_status_notificacao" AS ENUM (
    'pendente',
    'enviada',
    'falhou'
);


ALTER TYPE "public"."ag_status_notificacao" OWNER TO "postgres";


CREATE TYPE "public"."ag_status_reserva" AS ENUM (
    'processando',
    'confirmada',
    'cancelada_convidado',
    'cancelada_dono',
    'remarcada',
    'falhou'
);


ALTER TYPE "public"."ag_status_reserva" OWNER TO "postgres";


CREATE TYPE "public"."ag_tipo_excecao" AS ENUM (
    'indisponivel',
    'horario_especial'
);


ALTER TYPE "public"."ag_tipo_excecao" OWNER TO "postgres";


CREATE TYPE "public"."ag_tipo_notificacao" AS ENUM (
    'confirmacao_convidado',
    'aviso_dono_nova',
    'aviso_dono_remarcada',
    'aviso_dono_cancelada',
    'cancelamento_convidado',
    'reconectar_google'
);


ALTER TYPE "public"."ag_tipo_notificacao" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_fn_desfaz_remarcacao"("p_nova_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."ag_fn_desfaz_remarcacao"("p_nova_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_fn_remarcar_reservar"("p_antiga_id" "uuid", "p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_token_hash" "text", "p_fuso" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."ag_fn_remarcar_reservar"("p_antiga_id" "uuid", "p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_token_hash" "text", "p_fuso" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_fn_substitui_excecoes_data"("p_conta_id" "uuid", "p_data" "date", "p_tipo" "public"."ag_tipo_excecao", "p_faixas" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."ag_fn_substitui_excecoes_data"("p_conta_id" "uuid", "p_data" "date", "p_tipo" "public"."ag_tipo_excecao", "p_faixas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_fn_substitui_horarios"("p_conta_id" "uuid", "p_faixas" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- Serializa edições da mesma conta para a validação do trigger enxergar um estado estável.
  perform pg_advisory_xact_lock(hashtextextended('ag_horarios:' || p_conta_id::text, 0));
  delete from public.ag_horarios_semanais where conta_id = p_conta_id;
  insert into public.ag_horarios_semanais (conta_id, dia_semana, inicio, fim)
  select p_conta_id, (f ->> 'dia_semana')::smallint, (f ->> 'inicio')::time, (f ->> 'fim')::time
  from jsonb_array_elements(coalesce(p_faixas, '[]'::jsonb)) as f;
end;
$$;


ALTER FUNCTION "public"."ag_fn_substitui_horarios"("p_conta_id" "uuid", "p_faixas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_fn_valida_faixas"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."ag_fn_valida_faixas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ag_tg_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."ag_tg_atualizado_em"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ag_conexoes_google" (
    "conta_id" "uuid" NOT NULL,
    "refresh_token_cifrado" "text" NOT NULL,
    "escopos" "text"[] NOT NULL,
    "status" "public"."ag_status_conexao" DEFAULT 'ativa'::"public"."ag_status_conexao" NOT NULL,
    "revogada_em" timestamp with time zone,
    "aviso_reconectar_enviado" boolean DEFAULT false NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ag_conexoes_google" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_contas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "google_sub" "text" NOT NULL,
    "email" "text" NOT NULL,
    "nome_exibicao" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "mensagem_boas_vindas" "text",
    "fuso" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "feriados_ativos" boolean DEFAULT true NOT NULL,
    "feriados_desligados" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "termos_aceitos_em" timestamp with time zone,
    "suspensa_em" timestamp with time zone,
    CONSTRAINT "ag_contas_mensagem_ck" CHECK ((("mensagem_boas_vindas" IS NULL) OR ("char_length"("mensagem_boas_vindas") <= 300))),
    CONSTRAINT "ag_contas_nome_ck" CHECK ((("char_length"("nome_exibicao") >= 1) AND ("char_length"("nome_exibicao") <= 100))),
    CONSTRAINT "ag_contas_slug_ck" CHECK (("slug" ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'::"text")),
    CONSTRAINT "ag_contas_slug_reservado_ck" CHECK (("slug" <> ALL (ARRAY['painel'::"text", 'entrar'::"text", 'sair'::"text", 'api'::"text", 'r'::"text", '_next'::"text", 'favicon.ico'::"text", 'robots.txt'::"text", 'sitemap.xml'::"text", 'ajuda'::"text", 'termos'::"text", 'privacidade'::"text"])))
);


ALTER TABLE "public"."ag_contas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ag_contas"."termos_aceitos_em" IS 'Aceite dos Termos e da Privacidade (spec v0.5, 8.11). Nulo = boas-vindas pendentes.';



COMMENT ON COLUMN "public"."ag_contas"."suspensa_em" IS 'Conta suspensa por abuso (spec v0.5, 8.13). Nulo = ativa.';



CREATE TABLE IF NOT EXISTS "public"."ag_excecoes_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "tipo" "public"."ag_tipo_excecao" NOT NULL,
    "inicio" time without time zone,
    "fim" time without time zone,
    CONSTRAINT "ag_excecoes_data_tipo_ck" CHECK (((("tipo" = 'indisponivel'::"public"."ag_tipo_excecao") AND ("inicio" IS NULL) AND ("fim" IS NULL)) OR (("tipo" = 'horario_especial'::"public"."ag_tipo_excecao") AND ("inicio" IS NOT NULL) AND ("fim" IS NOT NULL) AND ("fim" > "inicio"))))
);


ALTER TABLE "public"."ag_excecoes_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_horarios_semanais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "dia_semana" smallint NOT NULL,
    "inicio" time without time zone NOT NULL,
    "fim" time without time zone NOT NULL,
    CONSTRAINT "ag_horarios_semanais_dia_ck" CHECK ((("dia_semana" >= 0) AND ("dia_semana" <= 6))),
    CONSTRAINT "ag_horarios_semanais_faixa_ck" CHECK (("fim" > "inicio")),
    CONSTRAINT "ag_horarios_semanais_multiplo_ck" CHECK (((((EXTRACT("minute" FROM "inicio"))::integer % 5) = 0) AND (EXTRACT("second" FROM "inicio") = (0)::numeric) AND (((EXTRACT("minute" FROM "fim"))::integer % 5) = 0) AND (EXTRACT("second" FROM "fim") = (0)::numeric)))
);


ALTER TABLE "public"."ag_horarios_semanais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_notificacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "reserva_id" "uuid",
    "tipo" "public"."ag_tipo_notificacao" NOT NULL,
    "status" "public"."ag_status_notificacao" DEFAULT 'pendente'::"public"."ag_status_notificacao" NOT NULL,
    "tentativas" smallint DEFAULT 0 NOT NULL,
    "resend_id" "text",
    "erro" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enviada_em" timestamp with time zone,
    CONSTRAINT "ag_notificacoes_reserva_ck" CHECK ((("reserva_id" IS NOT NULL) OR ("tipo" = 'reconectar_google'::"public"."ag_tipo_notificacao"))),
    CONSTRAINT "ag_notificacoes_tentativas_ck" CHECK ((("tentativas" >= 0) AND ("tentativas" <= 5)))
);


ALTER TABLE "public"."ag_notificacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_reservas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "tipo_evento_id" "uuid" NOT NULL,
    "inicio" timestamp with time zone NOT NULL,
    "fim" timestamp with time zone NOT NULL,
    "nome_convidado" "text" NOT NULL,
    "email_convidado" "text" NOT NULL,
    "observacao" "text",
    "fuso_convidado" "text" NOT NULL,
    "status" "public"."ag_status_reserva" DEFAULT 'processando'::"public"."ag_status_reserva" NOT NULL,
    "google_evento_id" "text",
    "link_meet" "text",
    "token_hash" "text" NOT NULL,
    "remarcada_de_id" "uuid",
    "motivo_cancelamento" "text",
    "cancelada_em" timestamp with time zone,
    "dados_anonimizados_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ag_reservas_email_ck" CHECK ((("email_convidado" = "lower"("email_convidado")) AND ("email_convidado" ~~ '%_@_%'::"text"))),
    CONSTRAINT "ag_reservas_faixa_ck" CHECK (("fim" > "inicio")),
    CONSTRAINT "ag_reservas_motivo_ck" CHECK ((("motivo_cancelamento" IS NULL) OR ("char_length"("motivo_cancelamento") <= 500))),
    CONSTRAINT "ag_reservas_nome_ck" CHECK ((("char_length"("nome_convidado") >= 1) AND ("char_length"("nome_convidado") <= 100))),
    CONSTRAINT "ag_reservas_observacao_ck" CHECK ((("observacao" IS NULL) OR ("char_length"("observacao") <= 1000)))
);


ALTER TABLE "public"."ag_reservas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ag_tipos_evento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "descricao" "text",
    "duracao_min" integer DEFAULT 30 NOT NULL,
    "com_meet" boolean DEFAULT true NOT NULL,
    "antecedencia_min" integer DEFAULT 240 NOT NULL,
    "janela_dias" integer DEFAULT 60 NOT NULL,
    "intervalo_antes_min" integer DEFAULT 0 NOT NULL,
    "intervalo_depois_min" integer DEFAULT 0 NOT NULL,
    "passo_min" integer DEFAULT 30 NOT NULL,
    "visivel_na_pagina" boolean DEFAULT true NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "excluido_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ag_tipos_evento_antecedencia_ck" CHECK ((("antecedencia_min" >= 0) AND ("antecedencia_min" <= 10080))),
    CONSTRAINT "ag_tipos_evento_descricao_ck" CHECK ((("descricao" IS NULL) OR ("char_length"("descricao") <= 1000))),
    CONSTRAINT "ag_tipos_evento_duracao_ck" CHECK (((("duracao_min" >= 15) AND ("duracao_min" <= 240)) AND (("duracao_min" % 5) = 0))),
    CONSTRAINT "ag_tipos_evento_intervalos_ck" CHECK (((("intervalo_antes_min" >= 0) AND ("intervalo_antes_min" <= 120)) AND (("intervalo_depois_min" >= 0) AND ("intervalo_depois_min" <= 120)))),
    CONSTRAINT "ag_tipos_evento_janela_ck" CHECK ((("janela_dias" >= 1) AND ("janela_dias" <= 365))),
    CONSTRAINT "ag_tipos_evento_nome_ck" CHECK ((("char_length"("nome") >= 1) AND ("char_length"("nome") <= 60))),
    CONSTRAINT "ag_tipos_evento_passo_ck" CHECK (("passo_min" = ANY (ARRAY[10, 15, 20, 30, 45, 60, 90, 120]))),
    CONSTRAINT "ag_tipos_evento_slug_ck" CHECK (("slug" ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'::"text"))
);


ALTER TABLE "public"."ag_tipos_evento" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ag_conexoes_google"
    ADD CONSTRAINT "ag_conexoes_google_pkey" PRIMARY KEY ("conta_id");



ALTER TABLE ONLY "public"."ag_contas"
    ADD CONSTRAINT "ag_contas_google_sub_key" UNIQUE ("google_sub");



ALTER TABLE ONLY "public"."ag_contas"
    ADD CONSTRAINT "ag_contas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_contas"
    ADD CONSTRAINT "ag_contas_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ag_excecoes_data"
    ADD CONSTRAINT "ag_excecoes_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_horarios_semanais"
    ADD CONSTRAINT "ag_horarios_semanais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_notificacoes"
    ADD CONSTRAINT "ag_notificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_reservas"
    ADD CONSTRAINT "ag_reservas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ag_reservas"
    ADD CONSTRAINT "ag_reservas_sem_sobreposicao" EXCLUDE USING "gist" ("conta_id" WITH =, "tstzrange"("inicio", "fim", '[)'::"text") WITH &&) WHERE (("status" = ANY (ARRAY['processando'::"public"."ag_status_reserva", 'confirmada'::"public"."ag_status_reserva"])));



ALTER TABLE ONLY "public"."ag_reservas"
    ADD CONSTRAINT "ag_reservas_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."ag_tipos_evento"
    ADD CONSTRAINT "ag_tipos_evento_pkey" PRIMARY KEY ("id");



CREATE INDEX "ag_excecoes_data_conta_idx" ON "public"."ag_excecoes_data" USING "btree" ("conta_id", "data");



CREATE INDEX "ag_horarios_semanais_conta_idx" ON "public"."ag_horarios_semanais" USING "btree" ("conta_id", "dia_semana");



CREATE INDEX "ag_notificacoes_conta_idx" ON "public"."ag_notificacoes" USING "btree" ("conta_id");



CREATE INDEX "ag_notificacoes_pendentes_idx" ON "public"."ag_notificacoes" USING "btree" ("status") WHERE ("status" <> 'enviada'::"public"."ag_status_notificacao");



CREATE UNIQUE INDEX "ag_notificacoes_uk" ON "public"."ag_notificacoes" USING "btree" ("reserva_id", "tipo");



CREATE INDEX "ag_reservas_conta_inicio_idx" ON "public"."ag_reservas" USING "btree" ("conta_id", "inicio");



CREATE INDEX "ag_reservas_email_conta_idx" ON "public"."ag_reservas" USING "btree" ("email_convidado", "conta_id");



CREATE INDEX "ag_reservas_remarcada_de_idx" ON "public"."ag_reservas" USING "btree" ("remarcada_de_id");



CREATE INDEX "ag_reservas_tipo_idx" ON "public"."ag_reservas" USING "btree" ("tipo_evento_id");



CREATE UNIQUE INDEX "ag_tipos_evento_slug_uk" ON "public"."ag_tipos_evento" USING "btree" ("conta_id", "slug") WHERE ("excluido_em" IS NULL);



CREATE OR REPLACE TRIGGER "ag_fn_valida_faixas" BEFORE INSERT OR UPDATE ON "public"."ag_excecoes_data" FOR EACH ROW EXECUTE FUNCTION "public"."ag_fn_valida_faixas"();



CREATE OR REPLACE TRIGGER "ag_fn_valida_faixas" BEFORE INSERT OR UPDATE ON "public"."ag_horarios_semanais" FOR EACH ROW EXECUTE FUNCTION "public"."ag_fn_valida_faixas"();



CREATE OR REPLACE TRIGGER "ag_tg_atualizado_em" BEFORE UPDATE ON "public"."ag_conexoes_google" FOR EACH ROW EXECUTE FUNCTION "public"."ag_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "ag_tg_atualizado_em" BEFORE UPDATE ON "public"."ag_contas" FOR EACH ROW EXECUTE FUNCTION "public"."ag_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "ag_tg_atualizado_em" BEFORE UPDATE ON "public"."ag_reservas" FOR EACH ROW EXECUTE FUNCTION "public"."ag_tg_atualizado_em"();



CREATE OR REPLACE TRIGGER "ag_tg_atualizado_em" BEFORE UPDATE ON "public"."ag_tipos_evento" FOR EACH ROW EXECUTE FUNCTION "public"."ag_tg_atualizado_em"();



ALTER TABLE ONLY "public"."ag_conexoes_google"
    ADD CONSTRAINT "ag_conexoes_google_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."ag_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_excecoes_data"
    ADD CONSTRAINT "ag_excecoes_data_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."ag_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_horarios_semanais"
    ADD CONSTRAINT "ag_horarios_semanais_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."ag_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_notificacoes"
    ADD CONSTRAINT "ag_notificacoes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."ag_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_notificacoes"
    ADD CONSTRAINT "ag_notificacoes_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "public"."ag_reservas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_reservas"
    ADD CONSTRAINT "ag_reservas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."ag_contas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ag_reservas"
    ADD CONSTRAINT "ag_reservas_remarcada_de_id_fkey" FOREIGN KEY ("remarcada_de_id") REFERENCES "public"."ag_reservas"("id");



ALTER TABLE ONLY "public"."ag_reservas"
    ADD CONSTRAINT "ag_reservas_tipo_evento_id_fkey" FOREIGN KEY ("tipo_evento_id") REFERENCES "public"."ag_tipos_evento"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ag_tipos_evento"
    ADD CONSTRAINT "ag_tipos_evento_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."ag_contas"("id") ON DELETE CASCADE;



ALTER TABLE "public"."ag_conexoes_google" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_contas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_excecoes_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_horarios_semanais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_notificacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_reservas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ag_tipos_evento" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."ag_fn_desfaz_remarcacao"("p_nova_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ag_fn_desfaz_remarcacao"("p_nova_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ag_fn_remarcar_reservar"("p_antiga_id" "uuid", "p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_token_hash" "text", "p_fuso" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ag_fn_remarcar_reservar"("p_antiga_id" "uuid", "p_inicio" timestamp with time zone, "p_fim" timestamp with time zone, "p_token_hash" "text", "p_fuso" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ag_fn_substitui_excecoes_data"("p_conta_id" "uuid", "p_data" "date", "p_tipo" "public"."ag_tipo_excecao", "p_faixas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ag_fn_substitui_excecoes_data"("p_conta_id" "uuid", "p_data" "date", "p_tipo" "public"."ag_tipo_excecao", "p_faixas" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ag_fn_substitui_horarios"("p_conta_id" "uuid", "p_faixas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ag_fn_substitui_horarios"("p_conta_id" "uuid", "p_faixas" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ag_fn_valida_faixas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ag_fn_valida_faixas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ag_tg_atualizado_em"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ag_tg_atualizado_em"() TO "service_role";



GRANT ALL ON TABLE "public"."ag_conexoes_google" TO "service_role";



GRANT ALL ON TABLE "public"."ag_contas" TO "service_role";



GRANT ALL ON TABLE "public"."ag_excecoes_data" TO "service_role";



GRANT ALL ON TABLE "public"."ag_horarios_semanais" TO "service_role";



GRANT ALL ON TABLE "public"."ag_notificacoes" TO "service_role";



GRANT ALL ON TABLE "public"."ag_reservas" TO "service_role";



GRANT ALL ON TABLE "public"."ag_tipos_evento" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







