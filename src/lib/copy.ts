// Textos oficiais do produto — seção 15 (conteúdo final, pt-BR). Nenhum texto de interface fora daqui.
// Rótulos de navegação e de campos vêm das seções 10 e 16 e do prompt de design. Textos fora da
// seção 15 aprovados pelo Alexandre em 04/11/2026 (8.2 e 8.3) ou marcados "a aprovar" (épicos seguintes).

export const copy = {
  appName: "Reunião",
  login: {
    button: "Entrar com Google",
    errors: {
      sem_acesso: "Este e-mail não tem acesso.",
      escopos: "Para funcionar, marque as duas permissões de agenda.",
      falha: "Não consegui consultar a agenda agora. Tente de novo em instantes.",
    },
    retry: "Tentar de novo",
  },
  // Nomes dos feriados da regra 11.4.
  holidays: {
    confraternizacao: "Confraternização Universal",
    carnaval_segunda: "Carnaval (segunda)",
    carnaval_terca: "Carnaval (terça)",
    cinzas: "Quarta-feira de Cinzas",
    sexta_santa: "Sexta-feira Santa",
    tiradentes: "Tiradentes",
    trabalho: "Dia do Trabalho",
    corpus_christi: "Corpus Christi",
    independencia: "Independência",
    aparecida: "Nossa Senhora Aparecida",
    finados: "Finados",
    republica: "Proclamação da República",
    consciencia_negra: "Consciência Negra",
    natal: "Natal",
  },
  // Unidades de tempo usadas pelos formatadores de src/lib/format.ts.
  units: { minutes: "min", hours: "h", day: "dia", days: "dias" },
  nav: {
    groups: { agenda: "Agenda", configurar: "Configurar" },
    eventTypes: "Tipos de evento",
    meetings: "Reuniões",
    availability: "Disponibilidade",
    account: "Conta",
    signOut: "Sair",
    viewMyPage: "Ver minha página",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
  },
  eventTypes: {
    title: "Tipos de evento",
    newType: "Novo tipo",
    empty: "Nenhum tipo de reunião ainda.",
    createFirst: "Criar o primeiro",
    copyLink: "Copiar link",
    linkCopied: "Link copiado.",
    open: "Abrir",
    meet: "Google Meet",
    hidden: "Oculto",
    inactive: "Inativo",
    moveUp: "Mover para cima",
    moveDown: "Mover para baixo",
    dragHandle: "Arrastar para reordenar",
  },
  eventTypeForm: {
    titleNew: "Novo tipo",
    groups: { basic: "Básico", location: "Local", rules: "Regras", visibility: "Visibilidade" },
    fields: {
      nome: "Nome",
      duracao_min: "Duração",
      descricao: "Descrição",
      slug: "Endereço",
      com_meet: "Google Meet",
      antecedencia_min: "Antecedência mínima",
      janela_dias: "Até quantos dias à frente",
      intervalo_antes_min: "Intervalo antes",
      intervalo_depois_min: "Intervalo depois",
      passo_min: "Horários começam a cada",
      visivel_na_pagina: "Mostrar na minha página",
      ativo: "Ativo",
    },
    save: "Salvar",
    delete: "Excluir",
    cancel: "Cancelar",
    back: "Tipos de evento",
    saved: "Salvo.",
    deleteConfirm: "Excluir este tipo de reunião? As reuniões já marcadas continuam valendo.",
    hiddenHint: "Desligado, o tipo some da sua página, mas o link direto continua funcionando.",
  },
  availability: {
    title: "Disponibilidade",
    save: "Salvar",
    saved: "Salvo.",
    weekly: {
      title: "Horários semanais",
      unavailable: "Indisponível",
      overlap: "Esses horários se sobrepõem.",
      copyTo: "Copiar para…",
      addRange: "Adicionar faixa",
      removeRange: "Remover faixa",
      apply: "Aplicar",
      start: "Início",
      end: "Fim",
      invalid: "Confira os horários: o fim precisa ser depois do início.",
    },
    days: {
      short: ["D", "S", "T", "Q", "Q", "S", "S"],
      long: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"],
    },
    dates: {
      title: "Datas específicas",
      add: "Adicionar data",
      unavailableAllDay: "Indisponível o dia todo",
      customHours: "Horários próprios",
      date: "Data",
      empty: "Nenhuma data específica.",
      remove: "Remover",
      edit: "Editar",
      cancel: "Cancelar",
    },
    holidays: {
      title: "Feriados",
      country: "Brasil",
      next: "Próximo:",
    },
  },
  errors: {
    slug_em_uso: "Esse endereço já está em uso.",
    slug_invalido: "Use de 3 a 30 letras minúsculas, números ou hífen.",
    dados_invalidos: "Confira os campos destacados.",
    generic: "Não consegui salvar agora. Tente de novo em instantes.",
    faixa_sobreposta: "Esses horários se sobrepõem.",
    excecao_conflitante: "Esses horários se sobrepõem.",
  },
} as const;

export type LoginErrorCode = keyof typeof copy.login.errors;

// Diz se o valor vindo da URL é um código de erro de login conhecido.
export function isLoginErrorCode(v: unknown): v is LoginErrorCode {
  return typeof v === "string" && v in copy.login.errors;
}

// Traduz um código de erro da API (seção 13) para o texto da seção 15.
export function apiErrorText(code: unknown): string {
  return typeof code === "string" && code in copy.errors
    ? copy.errors[code as keyof typeof copy.errors]
    : copy.errors.generic;
}
