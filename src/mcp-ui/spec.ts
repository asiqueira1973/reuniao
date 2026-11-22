// Descrição de um formulário do MCP (plano 9.6). O servidor monta (abrir_formulario_*) e o
// formulário genérico (src/mcp-ui/form.ts) desenha. Puro: usado no servidor e no navegador.

export type Opcao = { valor: string; rotulo: string };
// Mostra o campo só quando outro campo tem um dos valores dados.
export type Condicao = { campo: string; valores: string[] };

type Base = { nome: string; rotulo: string; ajuda?: string; obrigatorio?: boolean; mostrarSe?: Condicao };

export type Campo =
  | (Base & { tipo: "texto" | "email" | "textarea"; max?: number; placeholder?: string })
  | (Base & { tipo: "numero"; min?: number; max?: number; passo?: number; sufixo?: string })
  | (Base & { tipo: "selecao"; opcoes: Opcao[] })
  | (Base & { tipo: "interruptor" })
  | (Base & { tipo: "data"; min?: string })
  // Faixas da semana: valor = [{ dia_semana, inicio, fim }].
  | (Base & { tipo: "semana" })
  // Faixas de um dia: valor = [{ inicio, fim }].
  | (Base & { tipo: "faixas" })
  // Horário livre: carrega pelo horarios_livres com o tipo e a data de outros campos; valor = ISO.
  | (Base & { tipo: "horario"; campoTipo: string; campoData: string });

export type Valor = string | number | boolean | null | Array<Record<string, string | number>>;

export type Formulario = {
  formulario_id: string;
  titulo: string;
  descricao?: string;
  // Linhas de contexto mostradas no topo (por exemplo, a reunião que será cancelada).
  resumo?: string[];
  campos: Campo[];
  valores: Record<string, Valor>;
  // Campos que vão junto sem aparecer (por exemplo, o id do tipo em edição).
  fixos?: Record<string, string>;
  acao: string;
  botao: string;
  perigo?: boolean;
  avisos?: string[];
  fuso?: string;
};

export type RespostaDoSalvar =
  | { ok: true; resumo: string; ids?: string[] }
  | { ok: false; erros: Array<{ campo: string | null; mensagem: string }> };
