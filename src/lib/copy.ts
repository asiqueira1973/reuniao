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
  // Página pública e reserva (seção 15, épico 8.5).
  booking: {
    chooseType: "Escolha um tipo de reunião.",
    calendarTitle: "Escolha uma data e horário",
    timeZone: "Fuso horário",
    next: "Próximo",
    formTitle: "Seus dados",
    name: "Nome",
    email: "E-mail",
    notes: "Algo que eu deva saber? (opcional)",
    confirm: "Confirmar reunião",
    confirmedTitle: "Reunião marcada.",
    confirmedBody: "Enviamos a confirmação para {email}. O convite do Google Agenda também já chegou.",
    slotTaken: "Esse horário acabou de ser reservado. Escolha outro.",
    emptyMonth: "Sem horários neste mês.",
    nextMonth: "Ver próximo mês",
    googleError: "Não consegui consultar a agenda agora. Tente de novo em instantes.",
    agendaRevoked: "Agenda temporariamente indisponível.",
    createFailed: "Não consegui criar a reunião. Nada foi marcado. Tente de novo.",
    typeInactive: "Este tipo de reunião não está disponível.",
    limit: "Você já tem reuniões marcadas comigo. Para marcar outra, cancele uma delas pelo link do e-mail.",
    notFound: "Página não encontrada.",
    meet: "Google Meet",
    // a aprovar (8.5)
    back: "Voltar",
    previousMonth: "Mês anterior",
    joinMeet: "Entrar no Meet",
    loading: "Carregando horários…",
    invalidFields: "Confira o nome e o e-mail.",
    slotsOne: "1 horário",
    slotsMany: "{n} horários",
    noSlots: "sem horários",
  },
  // E-mails (seção 15: assuntos; corpo a aprovar 8.5).
  emails: {
    subjects: {
      confirmacao_convidado: "Confirmado: {tipo} com {dono} · {quando}",
      aviso_dono_nova: "Nova reunião: {convidado} · {quando}",
      reconectar_google: "Sua agenda foi desconectada",
    },
    // a aprovar (8.5)
    confirmationIntro: "Sua reunião com {dono} está marcada.",
    ownerIntro: "{convidado} marcou uma reunião com você.",
    reschedule: "Remarcar",
    cancel: "Cancelar",
    manageHint: "Para remarcar ou cancelar, use os botões acima.",
    guestNotes: "Observação",
    reconnectBody: "Sua agenda do Google foi desconectada. Ninguém consegue marcar até você reconectar.",
    reconnectButton: "Reconectar Google",
    when: "Quando",
    type: "Tipo",
    guest: "Convidado",
  },
  errors: {
    slug_em_uso: "Esse endereço já está em uso.",
    slug_invalido: "Use de 3 a 30 letras minúsculas, números ou hífen.",
    dados_invalidos: "Confira os campos destacados.",
    generic: "Não consegui salvar agora. Tente de novo em instantes.",
    faixa_sobreposta: "Esses horários se sobrepõem.",
    excecao_conflitante: "Esses horários se sobrepõem.",
    horario_indisponivel: "Esse horário acabou de ser reservado. Escolha outro.",
    limite_excedido: "Você já tem reuniões marcadas comigo. Para marcar outra, cancele uma delas pelo link do e-mail.",
    tipo_indisponivel: "Este tipo de reunião não está disponível.",
    agenda_indisponivel: "Agenda temporariamente indisponível.",
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
