// Ferramentas de leitura do MCP (plano 9.6). Só a conta do token; nada de token /r/, URL interna
// ou dado do Google além dos horários livres que a página pública já mostra.
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { formatDuration } from "@/lib/format";
import { AvailabilityLookupError, getAvailability } from "@/server/availability";
import { getHolidayState, getWeeklyRanges, listDateOverrides } from "@/server/db/availability";
import { listEventTypes } from "@/server/db/event-types";
import { getMeeting, listMeetings, listMeetingsBetween, MEETING_TABS } from "@/server/db/meetings";
import { CalendarError } from "@/server/google/calendar";
import { apiErrorText } from "@/lib/copy";
import { conta, erro, hojeNo, hora, inicioDoDia, ok, paginaPublica, quando, somarDias, tool, type McpContext } from "./shared";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const STATUS: Record<string, string> = { confirmada: "confirmada", cancelada_convidado: "cancelada pelo convidado", cancelada_dono: "cancelada por você" };
const data = z.iso.date();

export function registerReadTools(server: McpServer, ctx: McpContext): void {
  tool(server, "ver_conta", {
    title: "Ver minha conta",
    description: "Mostra o nome, o endereço público (o link para mandar às pessoas), o fuso horário, a mensagem de boas-vindas e se a agenda do Google está conectada.",
    input: z.object({}),
    escrita: false,
  }, async () => {
    const c = await conta(ctx);
    const dados = { nome: c.nome_exibicao, endereco: c.slug, link: paginaPublica(c.slug), fuso: c.fuso, mensagem_boas_vindas: c.mensagem_boas_vindas, email: c.email, google: c.conexao };
    return ok(`${c.nome_exibicao}: ${dados.link} (fuso ${c.fuso}). Google Agenda: ${c.conexao === "ativa" ? "conectada" : "desconectada, reconecte em Conta"}.`, dados);
  });

  tool(server, "listar_tipos_de_reuniao", {
    title: "Listar tipos de reunião",
    description: "Lista os tipos de reunião (nome, duração, Meet, se aparece na página, se está ativo) com o link direto de cada um.",
    input: z.object({}),
    escrita: false,
  }, async () => {
    const c = await conta(ctx);
    const tipos = (await listEventTypes(ctx.contaId)).map((t) => ({
      id: t.id, nome: t.nome, endereco: t.slug, link: `${paginaPublica(c.slug)}/${t.slug}`, duracao_min: t.duracao_min, com_meet: t.com_meet,
      antecedencia_min: t.antecedencia_min, janela_dias: t.janela_dias, intervalo_antes_min: t.intervalo_antes_min, intervalo_depois_min: t.intervalo_depois_min,
      passo_min: t.passo_min, visivel_na_pagina: t.visivel_na_pagina, ativo: t.ativo,
    }));
    const texto = tipos.length
      ? tipos.map((t) => `- ${t.nome} (${formatDuration(t.duracao_min)}${t.com_meet ? ", Meet" : ""}${t.ativo ? "" : ", inativo"}${t.visivel_na_pagina ? "" : ", só pelo link"}): ${t.link}`).join("\n")
      : "Nenhum tipo de reunião ainda.";
    return ok(texto, { tipos });
  });

  tool(server, "ver_disponibilidade", {
    title: "Ver disponibilidade",
    description: "Mostra os horários de atendimento da semana, as datas com horário especial ou indisponíveis e os feriados.",
    input: z.object({}),
    escrita: false,
  }, async () => {
    const c = await conta(ctx);
    const [semana, datas, feriados] = await Promise.all([getWeeklyRanges(ctx.contaId), listDateOverrides(ctx.contaId, hojeNo(c.fuso)), getHolidayState(ctx.contaId)]);
    const porDia = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const f = semana.filter((x) => x.dia_semana === d).map((x) => `${x.inicio}–${x.fim}`);
      return `${DIAS[d]}: ${f.length ? f.join(", ") : "indisponível"}`;
    });
    const texto = [
      ...porDia,
      datas.length ? `Datas especiais: ${datas.map((x) => `${x.data} ${x.tipo === "indisponivel" ? "indisponível" : x.faixas.map((f) => `${f.inicio}–${f.fim}`).join(", ")}`).join("; ")}` : "Sem datas especiais.",
      `Feriados nacionais: ${feriados.feriados_ativos ? "bloqueados" : "não bloqueados"}${feriados.feriados_desligados.length ? ` (exceto ${feriados.feriados_desligados.join(", ")})` : ""}.`,
    ].join("\n");
    return ok(texto, { fuso: c.fuso, semana, datas, feriados_ativos: feriados.feriados_ativos, feriados_desligados: feriados.feriados_desligados });
  });

  tool(server, "horarios_livres", {
    title: "Horários livres",
    description: "Horários livres de um tipo de reunião num período (até 14 dias), já descontando a agenda do Google, as reuniões marcadas, a antecedência e os feriados. São os mesmos horários que a página pública oferece.",
    input: z.object({
      tipo: z.string().min(1).max(40).describe("Endereço do tipo (campo 'endereco' de listar_tipos_de_reuniao), por exemplo reuniao-1h."),
      de: data.optional().describe("Primeiro dia, AAAA-MM-DD. Omita para hoje."),
      ate: data.optional().describe("Último dia, AAAA-MM-DD (até 14 dias depois de 'de'). Omita para 7 dias."),
    }),
    escrita: false,
  }, async ({ tipo, de, ate }) => {
    const c = await conta(ctx);
    const inicio = de ?? hojeNo(c.fuso);
    const fimMax = somarDias(inicio, 13);
    const fim = ate && ate < fimMax ? ate : ate ? fimMax : somarDias(inicio, 6);
    if (fim < inicio) return erro("'ate' precisa ser depois de 'de'.");
    try {
      const r = await getAvailability({ accountSlug: c.slug, typeSlug: tipo, from: inicio, to: fim });
      const dias = r.dias.filter((d) => d.horarios.length);
      const texto = dias.length
        ? dias.map((d) => `${d.data}: ${d.horarios.map((h) => hora(h, c.fuso)).join(", ")}`).join("\n")
        : `Nenhum horário livre de ${inicio} a ${fim}.`;
      return ok(texto, { tipo, fuso: c.fuso, de: inicio, ate: fim, dias: r.dias });
    } catch (e) {
      if (e instanceof AvailabilityLookupError || e instanceof CalendarError) return erro(apiErrorText(e.code));
      throw e;
    }
  });

  tool(server, "listar_reunioes", {
    title: "Listar reuniões",
    description: "Lista as reuniões: próximas (padrão), passadas ou canceladas, 50 por página, com convidado, tipo e horário.",
    input: z.object({
      aba: z.enum(MEETING_TABS as [string, ...string[]]).optional().describe("proximas, passadas ou canceladas."),
      pagina: z.number().int().min(0).max(100).optional(),
    }),
    escrita: false,
  }, async ({ aba, pagina }) => {
    const c = await conta(ctx);
    const r = await listMeetings(ctx.contaId, (aba ?? "proximas") as (typeof MEETING_TABS)[number], new Date(), pagina ?? 0);
    const reunioes = r.rows.map((m) => ({ ...m, quando: quando(m.inicio, c.fuso), status: STATUS[m.status] ?? m.status }));
    const texto = reunioes.length ? reunioes.map((m) => `- ${m.quando}: ${m.nome_convidado} (${m.tipo}, ${m.status}) [id ${m.id}]`).join("\n") : "Nenhuma reunião.";
    return ok(texto + (r.hasMore ? "\nHá mais: peça a próxima página." : ""), { reunioes, tem_mais: r.hasMore });
  });

  tool(server, "agenda_do_dia", {
    title: "Agenda do dia",
    description: "Reuniões confirmadas de um dia (padrão: hoje), na ordem do horário.",
    input: z.object({ data: data.optional().describe("AAAA-MM-DD. Omita para hoje.") }),
    escrita: false,
  }, async ({ data: dia }) => {
    const c = await conta(ctx);
    const d = dia ?? hojeNo(c.fuso);
    const rows = await listMeetingsBetween(ctx.contaId, inicioDoDia(d, c.fuso), inicioDoDia(somarDias(d, 1), c.fuso));
    const texto = rows.length ? rows.map((m) => `- ${hora(m.inicio, c.fuso)}–${hora(m.fim, c.fuso)} ${m.nome_convidado} (${m.tipo}) [id ${m.id}]`).join("\n") : `Nenhuma reunião em ${d}.`;
    return ok(texto, { data: d, fuso: c.fuso, reunioes: rows });
  });

  tool(server, "agenda_da_semana", {
    title: "Agenda da semana",
    description: "Reuniões confirmadas de 7 dias a partir de uma data (padrão: hoje), agrupadas por dia.",
    input: z.object({ inicio: data.optional().describe("Primeiro dia, AAAA-MM-DD. Omita para hoje.") }),
    escrita: false,
  }, async ({ inicio }) => {
    const c = await conta(ctx);
    const d = inicio ?? hojeNo(c.fuso);
    const rows = await listMeetingsBetween(ctx.contaId, inicioDoDia(d, c.fuso), inicioDoDia(somarDias(d, 7), c.fuso));
    const texto = rows.length ? rows.map((m) => `- ${quando(m.inicio, c.fuso)}: ${m.nome_convidado} (${m.tipo}) [id ${m.id}]`).join("\n") : `Nenhuma reunião de ${d} a ${somarDias(d, 6)}.`;
    return ok(texto, { de: d, ate: somarDias(d, 6), fuso: c.fuso, reunioes: rows });
  });

  tool(server, "ver_reuniao", {
    title: "Ver reunião",
    description: "Detalhe de uma reunião: convidado, tipo, horário, observação, link do Meet, motivo do cancelamento, remarcações e a situação de cada e-mail (com o id para reenviar_email).",
    input: z.object({ reuniao_id: z.uuid().describe("Id da reunião (de listar_reunioes ou da agenda).") }),
    escrita: false,
  }, async ({ reuniao_id }) => {
    const c = await conta(ctx);
    const m = await getMeeting(ctx.contaId, reuniao_id);
    if (!m) return erro("Reunião não encontrada.");
    const linhas = [
      `${m.tipo} com ${m.nome_convidado} (${m.email_convidado})`,
      `Quando: ${quando(m.inicio, c.fuso)} (${STATUS[m.status] ?? m.status})`,
      m.link_meet ? `Meet: ${m.link_meet}` : null,
      m.observacao ? `Observação: ${m.observacao}` : null,
      m.motivo_cancelamento ? `Motivo do cancelamento: ${m.motivo_cancelamento}` : null,
      m.historico.length ? `Remarcada de: ${m.historico.map((h) => quando(h, c.fuso)).join(", ")}` : null,
      ...m.notificacoes.map((n) => `E-mail ${n.tipo}: ${n.status}${n.status === "enviada" ? "" : ` (id ${n.id})`}`),
    ].filter(Boolean);
    return ok(linhas.join("\n"), { reuniao: { ...m, quando: quando(m.inicio, c.fuso) } });
  });
}
