// Ferramentas de gravação do MCP (plano 9.6). Chamadas pelo "Salvar" dos formulários e, em
// clientes sem formulário, pelo próprio modelo (o host pede confirmação, porque são de escrita).
// Validam e gravam pelas mesmas funções do painel; respondem no formato RespostaDoSalvar, com os
// erros por campo para o formulário mostrar.
import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { accountPatchSchema } from "@/features/account/schema";
import { dateOverrideSchema, weeklySchema } from "@/features/availability/schema";
import { createEventTypeSchema, patchEventTypeSchema } from "@/features/event-types/schema";
import { track } from "@/server/analytics/track";
import { BookingError, createBooking } from "@/server/booking";
import { AccountError, updateAccountSettings } from "@/server/db/account-settings";
import { AvailabilityError, deleteDateOverride, replaceDateOverride, replaceWeeklyRanges } from "@/server/db/availability";
import { createEventType, EventTypeError, updateEventType } from "@/server/db/event-types";
import { OwnerActionError, cancelByOwner, resendNotification } from "@/server/owner-actions";
import { conta, falha, falhaDeValidacao, paginaPublica, quando, salvo, tool, type McpContext } from "./shared";

const num = z.coerce.number().int();
const SLOT_DATE = z.iso.datetime({ offset: true });

// Evento de uso (só o nome da ferramenta e o id da conta).
const usou = (ctx: McpContext, ferramenta: string) =>
  track({ nome: "reuniao_mcp_ferramenta", contaId: ctx.contaId, tela: "mcp", descricao: "assistente gravou pelo MCP", propriedades: { ferramenta, cliente: ctx.cliente.slice(0, 40) } });

export function registerWriteTools(server: McpServer, ctx: McpContext): void {
  tool(server, "salvar_tipo_de_reuniao", {
    title: "Salvar tipo de reunião",
    description: "Cria um tipo de reunião (sem tipo_id) ou altera um existente (com tipo_id). Prefira abrir_formulario_tipo_de_reuniao para a pessoa conferir antes.",
    input: z.object({
      tipo_id: z.uuid().optional(),
      nome: z.string().optional(),
      descricao: z.string().nullable().optional(),
      duracao_min: num.optional(),
      com_meet: z.boolean().optional(),
      antecedencia_min: num.optional(),
      janela_dias: num.optional(),
      intervalo_antes_min: num.optional(),
      intervalo_depois_min: num.optional(),
      passo_min: num.optional(),
      visivel_na_pagina: z.boolean().optional(),
      ativo: z.boolean().optional(),
    }),
    escrita: true,
  }, async ({ tipo_id, ...campos }) => {
    const limpos = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
    const parsed = tipo_id ? patchEventTypeSchema.safeParse(limpos) : createEventTypeSchema.safeParse(limpos);
    if (!parsed.success) return falhaDeValidacao(parsed.error.issues);
    try {
      const c = await conta(ctx);
      const t = tipo_id ? await updateEventType(ctx.contaId, tipo_id, parsed.data) : await createEventType(ctx.contaId, parsed.data as z.infer<typeof createEventTypeSchema>);
      usou(ctx, "salvar_tipo_de_reuniao");
      return salvo({ ok: true, ids: [t.id], resumo: `${tipo_id ? "Tipo atualizado" : "Tipo criado"}: ${t.nome} (${t.duracao_min} min). Link: ${paginaPublica(c.slug)}/${t.slug}` });
    } catch (e) {
      if (e instanceof EventTypeError) return falha(e.code, e.code === "slug_em_uso" ? "nome" : null);
      throw e;
    }
  });

  tool(server, "salvar_horarios_da_semana", {
    title: "Salvar horários da semana",
    description: "Troca TODOS os horários de atendimento da semana pelas faixas enviadas (dia_semana 0 = domingo … 6 = sábado; horários HH:MM, múltiplos de 5 min). Dia sem faixa fica indisponível. Prefira abrir_formulario_horarios_da_semana.",
    input: z.object({
      faixas: z.array(z.object({ dia_semana: num, inicio: z.string(), fim: z.string() })).max(70),
    }),
    escrita: true,
  }, async ({ faixas }) => {
    const parsed = weeklySchema.safeParse({ faixas });
    if (!parsed.success) return falhaDeValidacao(parsed.error.issues.map((i) => ({ ...i, path: ["faixas"] })));
    try {
      await replaceWeeklyRanges(ctx.contaId, parsed.data.faixas);
      usou(ctx, "salvar_horarios_da_semana");
      const dias = new Set(parsed.data.faixas.map((f) => f.dia_semana)).size;
      return salvo({ ok: true, resumo: `Horários salvos: ${parsed.data.faixas.length} faixas em ${dias} dias da semana.` });
    } catch (e) {
      if (e instanceof AvailabilityError) return falha(e.code, "faixas");
      throw e;
    }
  });

  tool(server, "salvar_data_especial", {
    title: "Salvar data especial",
    description: "Marca uma data como indisponível, dá a ela horários próprios (horario_especial, com faixas) ou volta ao horário normal (remover). Prefira abrir_formulario_data_especial.",
    input: z.object({
      data: z.iso.date(),
      tipo: z.enum(["indisponivel", "horario_especial", "remover"]),
      faixas: z.array(z.object({ inicio: z.string(), fim: z.string() })).max(10).optional(),
    }),
    escrita: true,
  }, async ({ data, tipo, faixas }) => {
    try {
      if (tipo === "remover") {
        await deleteDateOverride(ctx.contaId, data);
        usou(ctx, "salvar_data_especial");
        return salvo({ ok: true, resumo: `${data} voltou ao horário normal.` });
      }
      const parsed = dateOverrideSchema.safeParse(tipo === "indisponivel" ? { data, tipo } : { data, tipo, faixas: faixas ?? [] });
      if (!parsed.success) return falhaDeValidacao(parsed.error.issues.map((i) => ({ ...i, path: [i.path[0] === "data" ? "data" : "faixas"] })));
      await replaceDateOverride(ctx.contaId, parsed.data);
      usou(ctx, "salvar_data_especial");
      return salvo({ ok: true, resumo: tipo === "indisponivel" ? `${data} marcado como indisponível.` : `${data} com horários próprios: ${(faixas ?? []).map((f) => `${f.inicio}–${f.fim}`).join(", ")}.` });
    } catch (e) {
      if (e instanceof AvailabilityError) return falha(e.code, "faixas");
      throw e;
    }
  });

  tool(server, "marcar_reuniao", {
    title: "Marcar reunião",
    description: "Marca uma reunião com alguém num horário livre (o 'horario' é um dos instantes ISO devolvidos por horarios_livres). Cria o evento no Google Agenda com Meet e manda o convite e o e-mail de confirmação ao convidado. Prefira abrir_formulario_marcar_reuniao.",
    input: z.object({
      tipo: z.string().min(1).max(40).describe("Endereço do tipo."),
      horario: SLOT_DATE.describe("Início, ISO com fuso, de horarios_livres."),
      nome: z.string().trim().min(1).max(100),
      email: z.email().max(254),
      observacao: z.string().max(1000).nullable().optional(),
    }),
    escrita: true,
  }, async (a) => {
    const c = await conta(ctx);
    try {
      const r = await createBooking({ conta: c.slug, tipo: a.tipo, inicio: a.horario, nome: a.nome, email: a.email.toLowerCase(), observacao: a.observacao?.trim() || null, fuso: c.fuso });
      usou(ctx, "marcar_reuniao");
      return salvo({ ok: true, ids: [r.id], resumo: `Reunião marcada com ${a.nome} em ${quando(r.inicio, c.fuso)}.${r.link_meet ? ` Meet: ${r.link_meet}` : ""} O convite foi enviado para ${a.email}.` });
    } catch (e) {
      if (e instanceof BookingError) return falha(e.code, e.code === "horario_indisponivel" ? "horario" : e.code === "limite_excedido" ? "email" : null);
      throw e;
    }
  });

  tool(server, "cancelar_reuniao", {
    title: "Cancelar reunião",
    description: "Cancela uma reunião confirmada que ainda não começou: apaga o evento do Google Agenda e avisa o convidado por e-mail, com o motivo. Prefira abrir_formulario_cancelar_reuniao para a pessoa confirmar.",
    input: z.object({ reuniao_id: z.uuid(), motivo: z.string().max(500).nullable().optional() }),
    escrita: true,
  }, async ({ reuniao_id, motivo }) => {
    try {
      await cancelByOwner(ctx.contaId, reuniao_id, motivo?.trim() || null);
      usou(ctx, "cancelar_reuniao");
      return salvo({ ok: true, ids: [reuniao_id], resumo: "Reunião cancelada. O evento saiu do Google Agenda e o convidado foi avisado por e-mail." });
    } catch (e) {
      if (e instanceof OwnerActionError) return falha(e.code);
      throw e;
    }
  });

  tool(server, "salvar_conta", {
    title: "Salvar conta",
    description: "Altera o nome de exibição, a mensagem de boas-vindas da página e/ou o fuso horário. O endereço público não muda por aqui.",
    input: z.object({
      nome_exibicao: z.string().optional(),
      mensagem_boas_vindas: z.string().nullable().optional(),
      fuso: z.string().optional(),
    }),
    escrita: true,
  }, async (a) => {
    const limpos = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
    const parsed = accountPatchSchema.safeParse(limpos);
    if (!parsed.success) return falhaDeValidacao(parsed.error.issues);
    try {
      const c = await updateAccountSettings(ctx.contaId, parsed.data);
      usou(ctx, "salvar_conta");
      return salvo({ ok: true, resumo: `Conta salva: ${c.nome_exibicao}, fuso ${c.fuso}.` });
    } catch (e) {
      if (e instanceof AccountError) return falha(e.code);
      throw e;
    }
  });

  tool(server, "reenviar_email", {
    title: "Reenviar e-mail",
    description: "Reenvia um e-mail de uma reunião que falhou (o id vem de ver_reuniao). Até 5 tentativas no total.",
    input: z.object({ notificacao_id: z.uuid() }),
    escrita: true,
  }, async ({ notificacao_id }) => {
    try {
      const r = await resendNotification(ctx.contaId, notificacao_id);
      usou(ctx, "reenviar_email");
      return r === "enviada" ? salvo({ ok: true, resumo: "E-mail reenviado." }) : falha("servico_indisponivel");
    } catch (e) {
      if (e instanceof OwnerActionError) return falha(e.code);
      throw e;
    }
  });
}
