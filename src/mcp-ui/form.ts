// Formulário genérico do MCP (plano 9.6), aberto pelo assistente (Claude, ChatGPT) como MCP App.
// Recebe a descrição (Formulario) no resultado da ferramenta abrir_formulario_*, desenha os campos,
// e no "Salvar" chama a ferramenta de gravação (formulario.acao) pelo callServerTool. Os erros
// voltam por campo. Sem innerHTML e sem rede: tudo passa pelas ferramentas do servidor.
// Fechar sem salvar não grava nada, e o modelo é avisado (updateModelContext).
import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import type { Campo, Formulario, RespostaDoSalvar, Valor } from "./spec";

type Linha = Record<string, string | number>;
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const root = document.getElementById("app") as HTMLElement;
let form: Formulario | null = null;
let valores: Record<string, Valor> = {};
const erros = new Map<string, string>();
let erroGeral: string | null = null;
let salvando = false;
let concluido: { titulo: string; texto: string } | null = null;
const horariosCache = new Map<string, string[] | "carregando" | "erro">();

// Cria um elemento com atributos e filhos (sem innerHTML).
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...filhos: Array<Node | string | null>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v as EventListener);
    else if (k.startsWith("aria-") || k.startsWith("data-") || k === "for" || k === "role") e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  for (const f of filhos) if (f !== null) e.append(f);
  return e;
}

// Aplica o tema do host (claro/escuro, cores e fontes).
function aplicarTema(ctx: McpUiHostContext | undefined): void {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

const app = new App({ name: "Reunião — formulário", version: "1.0.0" });
// Handlers antes do connect: o resultado da ferramenta chega uma vez só.
app.ontoolresult = (r) => {
  const sc = (r as { structuredContent?: unknown }).structuredContent as Formulario | undefined;
  if (!sc || !Array.isArray(sc.campos)) return;
  form = sc;
  valores = { ...sc.valores };
  render();
};
app.onhostcontextchanged = aplicarTema;
app.onteardown = async () => ({});
void app.connect().then(() => aplicarTema(app.getHostContext()));

function visivel(c: Campo): boolean {
  if (!c.mostrarSe) return true;
  return c.mostrarSe.valores.includes(String(valores[c.mostrarSe.campo] ?? ""));
}

function set(nome: string, v: Valor, redesenhar = false): void {
  valores[nome] = v;
  erros.delete(nome);
  if (redesenhar) render();
}

// Hora "HH:MM" de um instante ISO no fuso do formulário.
function hora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: form?.fuso || undefined }).format(new Date(iso));
}

function campoEl(c: Campo): HTMLElement {
  const id = `f-${c.nome}`;
  const erro = erros.get(c.nome);
  const v = valores[c.nome];
  let controle: HTMLElement;
  switch (c.tipo) {
    case "texto":
    case "email":
      controle = el("input", { id, type: c.tipo === "email" ? "email" : "text", value: typeof v === "string" ? v : "", maxLength: c.max ?? 200, placeholder: c.placeholder ?? "", "aria-invalid": erro ? "true" : null, oninput: (e: Event) => set(c.nome, (e.target as HTMLInputElement).value) });
      break;
    case "textarea":
      controle = el("textarea", { id, value: typeof v === "string" ? v : "", maxLength: c.max ?? 1000, rows: 3, "aria-invalid": erro ? "true" : null, oninput: (e: Event) => set(c.nome, (e.target as HTMLTextAreaElement).value) });
      break;
    case "numero":
      controle = el("span", { class: "inline" },
        el("input", { id, type: "number", inputMode: "numeric", value: v === null || v === undefined ? "" : String(v), min: c.min, max: c.max, step: c.passo ?? 1, oninput: (e: Event) => { const t = (e.target as HTMLInputElement).value; set(c.nome, t === "" ? null : Number(t)); } }),
        c.sufixo ? el("span", { class: "suffix" }, c.sufixo) : null);
      break;
    case "selecao": {
      const s = el("select", { id, onchange: (e: Event) => set(c.nome, (e.target as HTMLSelectElement).value, true) });
      if (!c.obrigatorio || v === "" || v === null || v === undefined) s.append(new Option("Escolha…", ""));
      for (const o of c.opcoes) s.append(new Option(o.rotulo, o.valor));
      s.value = v === null || v === undefined ? "" : String(v);
      controle = s;
      break;
    }
    case "interruptor":
      controle = el("label", { class: "switch" },
        el("input", { id, type: "checkbox", checked: v === true, onchange: (e: Event) => set(c.nome, (e.target as HTMLInputElement).checked, true) }),
        el("span", {}, c.rotulo));
      return el("div", { class: "field" }, controle, c.ajuda ? el("p", { class: "help" }, c.ajuda) : null, erro ? el("p", { class: "error", role: "alert" }, erro) : null);
    case "data":
      controle = el("input", { id, type: "date", value: typeof v === "string" ? v : "", min: c.min, onchange: (e: Event) => set(c.nome, (e.target as HTMLInputElement).value, true) });
      break;
    case "faixas":
      controle = faixasEl(c.nome, (Array.isArray(v) ? v : []) as Linha[], null);
      break;
    case "semana":
      controle = semanaEl(c.nome, (Array.isArray(v) ? v : []) as Linha[]);
      break;
    case "horario":
      controle = horarioEl(c);
      break;
  }
  const rotulo = c.tipo === "semana" || c.tipo === "faixas" || c.tipo === "horario" ? el("p", { class: "label" }, c.rotulo) : el("label", { class: "label", for: id }, c.rotulo);
  return el("div", { class: "field" }, rotulo, controle, c.ajuda ? el("p", { class: "help" }, c.ajuda) : null, erro ? el("p", { class: "error", role: "alert" }, erro) : null);
}

// Lista de faixas início–fim; dia !== null grava junto o dia da semana (campo "semana").
function faixasEl(nome: string, todas: Linha[], dia: number | null): HTMLElement {
  const minhas = dia === null ? todas : todas.filter((f) => f.dia_semana === dia);
  const atualizar = (novas: Linha[]) => {
    const resto = dia === null ? [] : todas.filter((f) => f.dia_semana !== dia);
    set(nome, [...resto, ...novas], true);
  };
  const linhas = minhas.map((f, i) =>
    el("div", { class: "range" },
      el("input", { type: "time", step: 300, value: String(f.inicio ?? ""), "aria-label": "Início", onchange: (e: Event) => { const n = minhas.slice(); n[i] = { ...f, inicio: (e.target as HTMLInputElement).value }; atualizar(n); } }),
      el("span", {}, "–"),
      el("input", { type: "time", step: 300, value: String(f.fim ?? ""), "aria-label": "Fim", onchange: (e: Event) => { const n = minhas.slice(); n[i] = { ...f, fim: (e.target as HTMLInputElement).value }; atualizar(n); } }),
      el("button", { type: "button", class: "ghost", "aria-label": "Remover faixa", onclick: () => atualizar(minhas.filter((_, j) => j !== i)) }, "×")));
  const adicionar = el("button", { type: "button", class: "ghost add", onclick: () => {
    const ultima = minhas[minhas.length - 1];
    const nova: Linha = ultima ? { inicio: String(ultima.fim), fim: String(ultima.fim) === "23:00" ? "23:55" : addHoras(String(ultima.fim), 1) } : { inicio: "09:00", fim: "12:00" };
    if (dia !== null) nova.dia_semana = dia;
    atualizar([...minhas, nova]);
  } }, "+ Faixa");
  return el("div", { class: "ranges" }, ...linhas, adicionar);
}

function addHoras(hhmm: string, h: number): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const t = Math.min(23 * 60 + 55, (hh ?? 0) * 60 + (mm ?? 0) + h * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function semanaEl(nome: string, todas: Linha[]): HTMLElement {
  return el("div", { class: "week" }, ...[1, 2, 3, 4, 5, 6, 0].map((d) =>
    el("div", { class: "day" }, el("span", { class: "dayname" }, DIAS[d] ?? ""),
      todas.some((f) => f.dia_semana === d) ? faixasEl(nome, todas, d) : el("div", { class: "ranges" }, el("span", { class: "muted" }, "Indisponível"), el("button", { type: "button", class: "ghost add", onclick: () => set(nome, [...todas, { dia_semana: d, inicio: "09:00", fim: "12:00" }], true) }, "+ Faixa")))));
}

// Horários livres do tipo e da data escolhidos (carrega pelo horarios_livres).
function horarioEl(c: Extract<Campo, { tipo: "horario" }>): HTMLElement {
  const tipo = String(valores[c.campoTipo] ?? "");
  const data = String(valores[c.campoData] ?? "");
  if (!tipo || !data) return el("p", { class: "muted" }, "Escolha o tipo e a data para ver os horários livres.");
  const chave = `${tipo}|${data}`;
  const cache = horariosCache.get(chave);
  if (cache === undefined) {
    horariosCache.set(chave, "carregando");
    void app.callServerTool({ name: "horarios_livres", arguments: { tipo, de: data, ate: data } }).then((r) => {
      const sc = r.structuredContent as { dias?: Array<{ data: string; horarios: string[] }> } | undefined;
      horariosCache.set(chave, r.isError || !sc?.dias ? "erro" : (sc.dias.find((d) => d.data === data)?.horarios ?? []));
      render();
    }).catch(() => { horariosCache.set(chave, "erro"); render(); });
  }
  if (cache === undefined || cache === "carregando") return el("p", { class: "muted" }, "Carregando horários…");
  if (cache === "erro") return el("p", { class: "error" }, "Não consegui consultar a agenda agora.");
  if (cache.length === 0) return el("p", { class: "muted" }, "Nenhum horário livre neste dia.");
  return el("div", { class: "slots" }, ...cache.map((iso) =>
    el("button", { type: "button", class: valores[c.nome] === iso ? "slot selected" : "slot", "aria-pressed": valores[c.nome] === iso ? "true" : "false", onclick: () => set(c.nome, iso, true) }, hora(iso))));
}

// Monta os argumentos da gravação: campos visíveis + fixos.
function argumentos(): Record<string, unknown> {
  const args: Record<string, unknown> = { ...(form?.fixos ?? {}) };
  for (const c of form?.campos ?? []) {
    if (!visivel(c)) continue;
    const v = valores[c.nome];
    if (v === undefined) continue;
    args[c.nome] = typeof v === "string" ? v.trim() : v;
  }
  return args;
}

async function salvar(e: Event): Promise<void> {
  e.preventDefault();
  if (!form || salvando) return;
  salvando = true;
  erros.clear();
  erroGeral = null;
  render();
  try {
    const r = await app.callServerTool({ name: form.acao, arguments: argumentos() });
    const resp = r.structuredContent as RespostaDoSalvar | undefined;
    if (!resp) {
      erroGeral = "Não consegui salvar agora. Tente de novo.";
    } else if (resp.ok) {
      concluido = { titulo: "Pronto.", texto: resp.resumo };
      await app.updateModelContext({ content: [{ type: "text", text: `Formulário "${form.titulo}" salvo: ${resp.resumo}` }] }).catch(() => undefined);
    } else {
      for (const er of resp.erros) {
        if (er.campo) erros.set(er.campo, er.mensagem);
        else erroGeral = er.mensagem;
      }
    }
  } catch {
    erroGeral = "Não consegui salvar agora. Tente de novo.";
  }
  salvando = false;
  render();
}

async function cancelar(): Promise<void> {
  if (!form) return;
  concluido = { titulo: "Fechado sem salvar.", texto: "Nada foi gravado." };
  render();
  await app.updateModelContext({ content: [{ type: "text", text: `A pessoa fechou o formulário "${form.titulo}" sem salvar. Nada foi gravado.` }] }).catch(() => undefined);
  await app.requestTeardown().catch(() => undefined);
}

function render(): void {
  if (!form) {
    root.replaceChildren(el("p", { class: "muted" }, "Carregando…"));
    return;
  }
  if (concluido) {
    root.replaceChildren(el("section", { class: "done", role: "status" }, el("h2", {}, concluido.titulo), el("p", {}, concluido.texto)));
    return;
  }
  // Guarda o foco para não perdê-lo a cada redesenho.
  const ativo = document.activeElement as HTMLElement | null;
  const foco = ativo?.id;
  const f = el("form", { class: "form", novalidate: true, onsubmit: (e: Event) => void salvar(e) },
    el("h1", {}, form.titulo),
    form.descricao ? el("p", { class: "muted" }, form.descricao) : null,
    form.resumo?.length ? el("div", { class: "summary" }, ...form.resumo.map((l) => el("p", {}, l))) : null,
    form.avisos?.length ? el("div", { class: "warn", role: "status" }, ...form.avisos.map((a) => el("p", {}, a))) : null,
    ...form.campos.filter(visivel).map(campoEl),
    erroGeral ? el("p", { class: "error", role: "alert" }, erroGeral) : null,
    el("div", { class: "actions" },
      el("button", { type: "button", class: "secondary", onclick: () => void cancelar() }, "Cancelar"),
      el("button", { type: "submit", class: form.perigo ? "danger" : "primary", disabled: salvando }, salvando ? "Salvando…" : form.botao)));
  root.replaceChildren(f);
  if (foco) (document.getElementById(foco) as HTMLElement | null)?.focus();
}

render();
