// Ferramentas que abrem formulários (MCP Apps) no assistente (plano 9.6). Montam a descrição do
// formulário já preenchida com o que a pessoa disse e o que está gravado; não gravam nada. O
// "Salvar" do formulário chama a ferramenta de gravação correspondente (write-tools.ts).
import "server-only";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { STEP_OPTIONS } from "@/features/event-types/schema";
import { formatMinutes } from "@/lib/format";
import type { Campo, Formulario, Opcao } from "@/mcp-ui/spec";
import { getWeeklyRanges, listDateOverrides } from "@/server/db/availability";
import { getEventType, listEventTypes } from "@/server/db/event-types";
import { getMeeting } from "@/server/db/meetings";
import { conta, erro, formTool, hojeNo, quando, type McpContext } from "./shared";

const NOTICE = [0, 30, 60, 120, 240, 480, 720, 1440, 2880, 10080];
const BUFFER = [0, 5, 10, 15, 30, 45, 60, 90, 120];
const comAtual = (lista: readonly number[], atual: number): Opcao[] =>
  [...new Set([...lista, atual])].sort((a, b) => a - b).map((m) => ({ valor: String(m), rotulo: m === 0 ? "Nenhum" : formatMinutes(m) }));
const data = z.iso.date();

// Padrões de 7.3 para o tipo novo (os mesmos do painel).
const NOVO_TIPO = { duracao_min: 30, com_meet: true, antecedencia_min: 240, janela_dias: 60, intervalo_antes_min: 0, intervalo_depois_min: 0, passo_min: 30, visivel_na_pagina: true, ativo: true };

function fusos(atual: string): Opcao[] {
  const todos = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [atual];
  return [...new Set([atual, ...todos])].map((f) => ({ valor: f, rotulo: f.replaceAll("_", " ") }));
}

export function registerFormTools(server: McpServer, ctx: McpContext): void {
  formTool(server, "abrir_formulario_tipo_de_reuniao", {
    title: "Formulário de tipo de reunião",
    description: "Abre o formulário para criar um tipo de reunião novo ou, com tipo_id, editar um existente (nome, duração, Meet, antecedência, janela, intervalos, passo, visibilidade).",
    input: z.object({
      tipo_id: z.uuid().optional().describe("Id do tipo a editar (de listar_tipos_de_reuniao). Omita para criar um novo."),
      nome: z.string().max(60).optional(),
      duracao_min: z.number().int().optional().describe("Duração em minutos (15 a 240, múltiplo de 5)."),
      descricao: z.string().max(1000).optional(),
      com_meet: z.boolean().optional(),
    }),
  }, async (a) => {
    const atual = a.tipo_id ? await getEventType(ctx.contaId, a.tipo_id) : null;
    if (a.tipo_id && !atual) return erro("Tipo de reunião não encontrado.");
    const base = atual ?? { ...NOVO_TIPO, nome: "", descricao: null };
    const valores = {
      nome: a.nome ?? base.nome, descricao: a.descricao ?? base.descricao ?? "", duracao_min: a.duracao_min ?? base.duracao_min,
      com_meet: a.com_meet ?? base.com_meet, antecedencia_min: String(base.antecedencia_min), janela_dias: base.janela_dias,
      intervalo_antes_min: String(base.intervalo_antes_min), intervalo_depois_min: String(base.intervalo_depois_min),
      passo_min: String(base.passo_min), visivel_na_pagina: base.visivel_na_pagina, ativo: base.ativo,
    };
    const campos: Campo[] = [
      { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true, max: 60 },
      { tipo: "numero", nome: "duracao_min", rotulo: "Duração", min: 15, max: 240, passo: 5, sufixo: "min" },
      { tipo: "textarea", nome: "descricao", rotulo: "Descrição", max: 1000 },
      { tipo: "interruptor", nome: "com_meet", rotulo: "Google Meet" },
      { tipo: "selecao", nome: "antecedencia_min", rotulo: "Antecedência mínima", opcoes: comAtual(NOTICE, base.antecedencia_min), obrigatorio: true },
      { tipo: "numero", nome: "janela_dias", rotulo: "Até quantos dias à frente", min: 1, max: 365, sufixo: "dias" },
      { tipo: "selecao", nome: "intervalo_antes_min", rotulo: "Intervalo antes", opcoes: comAtual(BUFFER, base.intervalo_antes_min), obrigatorio: true },
      { tipo: "selecao", nome: "intervalo_depois_min", rotulo: "Intervalo depois", opcoes: comAtual(BUFFER, base.intervalo_depois_min), obrigatorio: true },
      { tipo: "selecao", nome: "passo_min", rotulo: "Horários começam a cada", opcoes: STEP_OPTIONS.map((m) => ({ valor: String(m), rotulo: formatMinutes(m) })), obrigatorio: true },
      { tipo: "interruptor", nome: "visivel_na_pagina", rotulo: "Mostrar na minha página", ajuda: "Desligado, o tipo some da página, mas o link direto continua funcionando." },
      { tipo: "interruptor", nome: "ativo", rotulo: "Ativo" },
    ];
    return {
      formulario_id: randomUUID(), titulo: atual ? `Editar ${atual.nome}` : "Novo tipo de reunião", campos, valores,
      fixos: atual ? { tipo_id: atual.id } : undefined, acao: "salvar_tipo_de_reuniao", botao: "Salvar",
    } satisfies Formulario;
  });

  formTool(server, "abrir_formulario_horarios_da_semana", {
    title: "Formulário de horários da semana",
    description: "Abre o formulário com os horários de atendimento de cada dia da semana (várias faixas por dia), já com o que está gravado.",
    input: z.object({}),
  }, async () => {
    const semana = await getWeeklyRanges(ctx.contaId);
    return {
      formulario_id: randomUUID(), titulo: "Horários da semana", descricao: "Em que horários as pessoas podem marcar reunião com você.",
      campos: [{ tipo: "semana", nome: "faixas", rotulo: "Faixas por dia" }],
      valores: { faixas: semana.map((f) => ({ dia_semana: f.dia_semana, inicio: f.inicio, fim: f.fim })) },
      acao: "salvar_horarios_da_semana", botao: "Salvar horários",
    } satisfies Formulario;
  });

  formTool(server, "abrir_formulario_data_especial", {
    title: "Formulário de data especial",
    description: "Abre o formulário para marcar uma data como indisponível (folga, viagem), dar a ela horários diferentes ou voltar ao horário normal.",
    input: z.object({
      data: data.optional().describe("AAAA-MM-DD."),
      tipo: z.enum(["indisponivel", "horario_especial", "remover"]).optional(),
    }),
  }, async (a) => {
    const c = await conta(ctx);
    const hoje = hojeNo(c.fuso);
    const existente = a.data ? (await listDateOverrides(ctx.contaId, hoje)).find((d) => d.data === a.data) : undefined;
    return {
      formulario_id: randomUUID(), titulo: "Data especial",
      campos: [
        { tipo: "data", nome: "data", rotulo: "Data", obrigatorio: true, min: hoje },
        { tipo: "selecao", nome: "tipo", rotulo: "Nesse dia", obrigatorio: true, opcoes: [
          { valor: "indisponivel", rotulo: "Indisponível o dia todo" },
          { valor: "horario_especial", rotulo: "Horários diferentes" },
          { valor: "remover", rotulo: "Voltar ao horário normal" },
        ] },
        { tipo: "faixas", nome: "faixas", rotulo: "Horários desse dia", mostrarSe: { campo: "tipo", valores: ["horario_especial"] } },
      ],
      valores: {
        data: a.data ?? "", tipo: a.tipo ?? existente?.tipo ?? "indisponivel",
        faixas: existente?.faixas.length ? existente.faixas.map((f) => ({ inicio: f.inicio, fim: f.fim })) : [{ inicio: "09:00", fim: "12:00" }],
      },
      acao: "salvar_data_especial", botao: "Salvar",
    } satisfies Formulario;
  });

  formTool(server, "abrir_formulario_marcar_reuniao", {
    title: "Formulário para marcar reunião",
    description: "Abre o formulário para você marcar uma reunião com alguém: escolhe o tipo, o dia e um horário livre, e informa nome e e-mail do convidado. O convidado recebe o convite do Google Agenda e o e-mail de confirmação.",
    input: z.object({
      tipo: z.string().max(40).optional().describe("Endereço do tipo (de listar_tipos_de_reuniao)."),
      data: data.optional().describe("AAAA-MM-DD."),
      nome: z.string().max(100).optional(),
      email: z.string().max(254).optional(),
      observacao: z.string().max(1000).optional(),
    }),
  }, async (a) => {
    const c = await conta(ctx);
    const tipos = (await listEventTypes(ctx.contaId)).filter((t) => t.ativo);
    if (!tipos.length) return erro("Crie um tipo de reunião ativo antes de marcar.");
    const tipo = tipos.find((t) => t.slug === a.tipo)?.slug ?? (tipos.length === 1 ? tipos[0]!.slug : "");
    return {
      formulario_id: randomUUID(), titulo: "Marcar reunião", fuso: c.fuso,
      avisos: ["O convidado recebe o convite do Google Agenda e um e-mail com o link para remarcar ou cancelar."],
      campos: [
        { tipo: "selecao", nome: "tipo", rotulo: "Tipo de reunião", obrigatorio: true, opcoes: tipos.map((t) => ({ valor: t.slug, rotulo: t.nome })) },
        { tipo: "data", nome: "data", rotulo: "Dia", obrigatorio: true, min: hojeNo(c.fuso) },
        { tipo: "horario", nome: "horario", rotulo: `Horário (${c.fuso.replaceAll("_", " ")})`, campoTipo: "tipo", campoData: "data", obrigatorio: true },
        { tipo: "texto", nome: "nome", rotulo: "Nome do convidado", obrigatorio: true, max: 100 },
        { tipo: "email", nome: "email", rotulo: "E-mail do convidado", obrigatorio: true, max: 254 },
        { tipo: "textarea", nome: "observacao", rotulo: "Observação (opcional)", max: 1000 },
      ],
      valores: { tipo, data: a.data ?? "", horario: null, nome: a.nome ?? "", email: a.email ?? "", observacao: a.observacao ?? "" },
      acao: "marcar_reuniao", botao: "Marcar reunião",
    } satisfies Formulario;
  });

  formTool(server, "abrir_formulario_cancelar_reuniao", {
    title: "Formulário para cancelar reunião",
    description: "Abre a confirmação para cancelar uma reunião confirmada e futura, com um motivo opcional. O evento sai do Google Agenda e o convidado recebe um e-mail com o motivo.",
    input: z.object({ reuniao_id: z.uuid().describe("Id da reunião (de listar_reunioes ou da agenda).") }),
  }, async ({ reuniao_id }) => {
    const c = await conta(ctx);
    const m = await getMeeting(ctx.contaId, reuniao_id);
    if (!m) return erro("Reunião não encontrada.");
    if (m.status !== "confirmada" || new Date(m.inicio) <= new Date()) return erro("Só dá para cancelar reunião confirmada que ainda não começou.");
    return {
      formulario_id: randomUUID(), titulo: "Cancelar reunião", perigo: true,
      resumo: [`${m.tipo} com ${m.nome_convidado}`, quando(m.inicio, c.fuso)],
      campos: [{ tipo: "textarea", nome: "motivo", rotulo: "Motivo (vai para o convidado, opcional)", max: 500 }],
      valores: { motivo: "" }, fixos: { reuniao_id }, acao: "cancelar_reuniao", botao: "Cancelar reunião",
    } satisfies Formulario;
  });

  formTool(server, "abrir_formulario_conta", {
    title: "Formulário da conta",
    description: "Abre o formulário com o nome de exibição, a mensagem de boas-vindas da página e o fuso horário. O endereço público só muda pelo painel.",
    input: z.object({ nome_exibicao: z.string().max(100).optional(), mensagem_boas_vindas: z.string().max(300).optional() }),
  }, async (a) => {
    const c = await conta(ctx);
    return {
      formulario_id: randomUUID(), titulo: "Minha conta",
      campos: [
        { tipo: "texto", nome: "nome_exibicao", rotulo: "Nome de exibição", obrigatorio: true, max: 100 },
        { tipo: "textarea", nome: "mensagem_boas_vindas", rotulo: "Mensagem de boas-vindas", max: 300, ajuda: "Aparece na sua página pública, acima dos tipos de reunião." },
        { tipo: "selecao", nome: "fuso", rotulo: "Fuso horário", obrigatorio: true, opcoes: fusos(c.fuso) },
      ],
      valores: { nome_exibicao: a.nome_exibicao ?? c.nome_exibicao, mensagem_boas_vindas: a.mensagem_boas_vindas ?? c.mensagem_boas_vindas ?? "", fuso: c.fuso },
      acao: "salvar_conta", botao: "Salvar",
    } satisfies Formulario;
  });
}
