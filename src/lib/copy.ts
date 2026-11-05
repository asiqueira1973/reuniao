// Textos oficiais do produto — seção 15 (conteúdo final, pt-BR). Nenhum texto de interface fora daqui.
// Rótulos de navegação e de campos vêm das seções 10 e 16 e do prompt de design. Textos marcados
// "a aprovar" não estão na seção 15 (listados em plans/8.2-tipos-de-evento.md).

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
    units: { minutes: "min", hours: "h", days: "dias" },
    save: "Salvar",
    delete: "Excluir",
    cancel: "Cancelar",
    back: "Tipos de evento",
    // a aprovar (não estão na seção 15)
    saved: "Salvo.",
    deleteConfirm: "Excluir este tipo de reunião? As reuniões já marcadas continuam valendo.",
    hiddenHint: "Desligado, o tipo some da sua página, mas o link direto continua funcionando.",
  },
  errors: {
    slug_em_uso: "Esse endereço já está em uso.",
    // a aprovar
    slug_invalido: "Use de 3 a 30 letras minúsculas, números ou hífen.",
    dados_invalidos: "Confira os campos destacados.",
    generic: "Não consegui salvar agora. Tente de novo em instantes.",
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
