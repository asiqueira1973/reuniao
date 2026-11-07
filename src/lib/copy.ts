// Textos oficiais do produto — seção 15 (conteúdo final, pt-BR). Nenhum texto de interface fora daqui.
// Rótulos de navegação e de campos vêm das seções 10 e 16 e do prompt de design. Textos fora da
// seção 15 aprovados pelo Alexandre em 04/11/2026 (8.2, 8.3 e 8.5) ou marcados "a aprovar" (épicos seguintes).

export const copy = {
  appName: "Reunião",
  login: {
    button: "Entrar com Google",
    errors: {
      sem_acesso: "Este e-mail não tem acesso.",
      cadastros_pausados: "Cadastros pausados por hoje. Tente amanhã.", // spec v0.5 (8.10)
      suspensa: "Esta conta está suspensa.", // spec v0.5 (8.13)
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
    back: "Voltar",
    previousMonth: "Mês anterior",
    joinMeet: "Entrar no Meet",
    loading: "Carregando horários…",
    invalidFields: "Confira o nome e o e-mail.",
    slotsOne: "1 horário",
    slotsMany: "{n} horários",
    noSlots: "sem horários",
  },
  // Gerenciar, cancelar e remarcar (seção 15, épico 8.6).
  manage: {
    title: "Sua reunião",
    reschedule: "Remarcar",
    cancel: "Cancelar reunião",
    confirmNewTime: "Confirmar novo horário",
    cancelled: "Reunião cancelada. Avisei {dono}.",
    past: "Esta reunião já aconteceu ou está acontecendo.",
    invalidLink: "Este link não é válido.",
    cancelFailed: "Não consegui cancelar agora. Tente de novo.",
    // a aprovar (8.6)
    reason: "Motivo (opcional)",
    keep: "Manter reunião",
    wasCancelled: "Esta reunião foi cancelada.",
    wasRescheduled: "Esta reunião foi remarcada para {quando}. O link novo está no e-mail de confirmação.",
    rescheduleTitle: "Escolha o novo horário",
    currentTime: "Horário atual: {quando}",
    newTime: "Novo horário",
    rescheduleFailed: "Não consegui remarcar agora. Sua reunião continua no horário de antes. Tente de novo.",
  },
  // Reuniões do dono (seção 15 e épico 8.7).
  meetings: {
    title: "Reuniões",
    tabs: { proximas: "Próximas", passadas: "Passadas", canceladas: "Canceladas" },
    empty: "Nenhuma reunião marcada.",
    emailFailed: "E-mail não enviado",
    resend: "Reenviar",
    // a aprovar (8.7)
    confirmed: "Confirmada",
    cancelledStatus: "Cancelada",
    back: "Reuniões",
    notes: "Observação",
    meet: "Google Meet",
    rescheduledFrom: "Remarcada de {quando}",
    emails: "E-mails",
    emailSent: "Enviado",
    emailPending: "Pendente",
    cancel: "Cancelar reunião",
    reasonForGuest: "Motivo (opcional, vai para o convidado)",
    keep: "Manter reunião",
    cancelledOk: "Reunião cancelada. O convidado foi avisado.",
    cancelFailed: "Não consegui cancelar agora. Tente de novo.",
    reason: "Motivo",
    cancelledAt: "Cancelada em {quando}",
    loadMore: "Mostrar mais",
    resent: "Reenviado.",
    resendLimit: "Este e-mail já foi tentado 5 vezes.", // a aprovar (8.7)
    notificationTypes: {
      confirmacao_convidado: "Confirmação ao convidado",
      aviso_dono_nova: "Aviso de reunião nova",
      aviso_dono_remarcada: "Aviso de remarcação",
      aviso_dono_cancelada: "Aviso de cancelamento",
      cancelamento_convidado: "Cancelamento ao convidado",
      reconectar_google: "Reconectar Google",
    },
  },
  // E-mails (seção 15: assuntos; corpo aprovado em 05/11/2026).
  emails: {
    subjects: {
      confirmacao_convidado: "Confirmado: {tipo} com {dono} · {quando}",
      aviso_dono_nova: "Nova reunião: {convidado} · {quando}",
      reconectar_google: "Sua agenda foi desconectada",
      aviso_dono_remarcada: "Remarcada: {convidado} · {antes} → {depois}",
      aviso_dono_cancelada: "Cancelada: {convidado} · {quando}",
      cancelamento_convidado: "Cancelada: {tipo} com {dono} · {quando}",
    },
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
    // a aprovar (8.6)
    cancelledByGuestIntro: "{convidado} cancelou a reunião.",
    rescheduledIntro: "{convidado} remarcou a reunião.",
    reason: "Motivo",
    before: "Antes",
    after: "Agora",
    cancelledByOwnerIntro: "{dono} cancelou a reunião.", // a aprovar (8.7)
    bookAgain: "Marcar outro horário", // a aprovar (8.7)
    lostReschedule: "Falha ao remarcar: o horário antigo foi ocupado por outra reserva e o novo não pôde ser confirmado no Google.",
  },
  account: {
    // Seção 15: changeSlug e reconnectBanner/reconnectButton. O resto: a aprovar (8.8).
    title: "Conta",
    groups: { profile: "Perfil", google: "Google Agenda", danger: "Excluir conta" },
    fields: {
      nome_exibicao: "Nome de exibição",
      slug: "Endereço",
      mensagem_boas_vindas: "Mensagem de boas-vindas",
      mensagemHint: "Aparece na sua página pública, acima dos tipos de reunião.",
      fuso: "Fuso horário",
    },
    slugAvailable: "Endereço disponível.",
    changeSlug: "Links antigos deixam de funcionar. Continuar?",
    changeSlugConfirm: "Continuar",
    cancel: "Cancelar",
    save: "Salvar",
    saved: "Salvo.",
    googleCalendar: "Consultando sua agenda principal",
    connection: { ativa: "Conectada", revogada: "Desconectada", ausente: "Não conectada" },
    reconnect: "Reconectar",
    reconnectBanner: "Sua agenda do Google foi desconectada. Ninguém consegue marcar até você reconectar.",
    reconnectButton: "Reconectar Google",
    deleteIntro: "Apaga sua conta, seus tipos de reunião, horários e o histórico de reuniões. Os eventos já criados no seu Google Agenda continuam lá.",
    deleteTypeSlug: (slug: string) => `Para confirmar, digite ${slug}`,
    deleteButton: "Excluir conta",
  },
  privacy: {
    // Seção 20 (LGPD). Textos a aprovar (8.9). Bloco "sobre esta agenda" da /privacidade?de={slug}.
    title: "Privacidade",
    aboutThisPage: "Sobre esta agenda",
    link: "Privacidade",
    collected: "Quando você marca uma reunião por esta página, guardo seu nome, seu e-mail, seu fuso horário e a observação que você escrever. Eles servem só para marcar a reunião e avisar você e {dono}.",
    calendar: "A agenda do Google de {dono} é consultada apenas para mostrar os horários livres. Nada dela é guardado.",
    retention: "Seus dados ficam guardados por 24 meses depois da reunião. Depois disso, são anonimizados aqui. O convite também fica na agenda do Google de {dono}, que segue as regras do Google.",
    contact: "Para pedir a exclusão dos seus dados, escreva para",
    contactGeneric: "Para pedir a exclusão dos seus dados, escreva para a pessoa com quem você marcou a reunião.",
    ownerFallback: "a pessoa com quem você marcou",
    back: "Voltar",
  },
  home: {
    // Página inicial (spec v0.5, épico 8.12). A aprovar.
    title: "Sua agenda em um link.",
    subtitle: "Mande o seu link e as pessoas marcam reunião com você nos horários livres do seu Google Agenda. Grátis.",
    cta: "Entrar com Google",
    features: [
      { title: "Só horários livres", text: "O Reunião consulta o seu Google Agenda e nunca oferece um horário em que você já está ocupado." },
      { title: "Convite e Meet na hora", text: "A reunião entra na sua agenda com link do Google Meet, e o convite chega para quem marcou." },
      { title: "Cancelar e remarcar sem conversa", text: "Quem marcou recebe um link para cancelar ou trocar o horário. Você é avisado por e-mail." },
      { title: "Do seu jeito", text: "Tipos de reunião, dias e horários de atendimento, folgas e feriados nacionais, tudo configurável." },
    ],
    madeBy: "Um produto DabLab",
  },
  legal: {
    // Spec v0.5 (8.12). Rascunho para revisão jurídica. A aprovar.
    company: "DabLab — Alexandre da Silva de Siqueira LTDA - ME, CNPJ 61.033.268/0001-14, São Paulo/SP",
    contactEmail: "alexandre@dablab.com.br",
    updated: "Última atualização: 5 de novembro de 2026.",
    terms: "Termos de uso",
    privacy: "Política de privacidade",
    footerAgree: "Ao entrar, você concorda com os Termos de uso e a Política de privacidade.",
    privacySections: [
      {
        title: "Quem somos",
        paragraphs: [
          "O Reunião (reuniao.app.br) é um serviço gratuito de agendamento da DabLab — Alexandre da Silva de Siqueira LTDA - ME, CNPJ 61.033.268/0001-14, com sede em São Paulo/SP.",
          "Para qualquer assunto sobre privacidade, escreva para alexandre@dablab.com.br.",
        ],
      },
      {
        title: "Se você tem uma agenda no Reunião",
        paragraphs: [
          "Guardamos o seu nome, o seu e-mail e o identificador da sua conta Google; as configurações que você faz (endereço, tipos de reunião, horários, fuso, mensagem); e a autorização de acesso ao seu Google Agenda, sempre cifrada.",
          "Usamos esses dados para manter a sua conta, mostrar os seus horários livres na sua página, criar, alterar e cancelar os eventos das reuniões marcadas e mandar os avisos por e-mail. A base legal é a execução do contrato que você aceita nos Termos de uso (LGPD, art. 7º, V).",
        ],
      },
      {
        title: "O que fazemos com o seu Google Agenda",
        paragraphs: [
          "O Reunião pede só duas permissões: ver quando você está livre ou ocupado, para não oferecer horários em que você já tem compromisso; e criar e gerenciar os eventos que o próprio Reunião cria para as reuniões marcadas.",
          "Não lemos título, descrição, local nem participantes dos seus outros compromissos. O livre/ocupado é consultado na hora e não é guardado.",
          "O uso e a transferência, pelo Reunião, de informações recebidas das APIs do Google seguem a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.",
          "Não vendemos esses dados, não os usamos para publicidade nem para treinar modelos de inteligência artificial, e ninguém os lê, a não ser quando você pede ajuda, para segurança ou quando a lei exigir.",
        ],
      },
      {
        title: "Se você marcou uma reunião",
        paragraphs: [
          "Guardamos o nome, o e-mail, o fuso horário e a observação que você escreveu. Eles servem para marcar a reunião, criar o convite no Google Agenda de quem você agendou e mandar os e-mails de confirmação, cancelamento e remarcação.",
          "Quem decide sobre esses dados é o dono da agenda com quem você marcou; o Reunião os trata em nome dele. Você pode pedir a exclusão a ele ou a nós.",
        ],
      },
      {
        title: "Com quem compartilhamos",
        paragraphs: [
          "Só com os serviços que fazem o Reunião funcionar: Google (agenda e Meet), Resend (envio de e-mails), Vercel (hospedagem) e Supabase (banco de dados). Alguns ficam fora do Brasil, com garantias contratuais de proteção de dados. Não vendemos dados a ninguém.",
        ],
      },
      {
        title: "Por quanto tempo",
        paragraphs: [
          "Os dados da sua conta ficam guardados enquanto ela existir. Os dados das reuniões são anonimizados 24 meses depois da data da reunião. O convite que foi para o Google Agenda segue as regras do Google.",
          "Quando você exclui a sua conta, revogamos o acesso ao seu Google Agenda e apagamos os seus dados e os das reuniões. Os eventos já criados no seu Google Agenda continuam lá.",
        ],
      },
      {
        title: "Segurança",
        paragraphs: [
          "A autorização do Google é guardada cifrada, o acesso aos dados é restrito ao servidor do Reunião e todas as conexões usam HTTPS.",
        ],
      },
      {
        title: "Seus direitos",
        paragraphs: [
          "Pela LGPD, você pode pedir confirmação de que tratamos os seus dados, acesso, correção, exclusão, portabilidade e informações sobre o compartilhamento. Escreva para alexandre@dablab.com.br. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
          "Você pode retirar o acesso do Reunião ao seu Google a qualquer momento em myaccount.google.com/permissions, ou excluir a sua conta em Conta, no painel.",
        ],
      },
      {
        title: "Cookies",
        paragraphs: [
          "Usamos só cookies essenciais: o da sessão de quem entra no painel e um de curta duração para mostrar a confirmação de uma reserva. Não usamos cookies de rastreamento nem de publicidade.",
        ],
      },
      {
        title: "Mudanças",
        paragraphs: [
          "Se esta política mudar de forma importante, avisaremos por e-mail ou no próprio Reunião.",
        ],
      },
    ],
    termsSections: [
      {
        title: "O serviço",
        paragraphs: [
          "O Reunião (reuniao.app.br) é um serviço gratuito da DabLab — Alexandre da Silva de Siqueira LTDA - ME, CNPJ 61.033.268/0001-14, São Paulo/SP — que permite publicar um link de agendamento ligado ao seu Google Agenda. Ao entrar no Reunião, você aceita estes Termos e a Política de privacidade.",
        ],
      },
      {
        title: "Sua conta",
        paragraphs: [
          "Para ter uma agenda, você entra com uma conta Google e autoriza o acesso ao seu Google Agenda. Você precisa ter 18 anos ou mais e é responsável pelo que acontece na sua conta e pelas informações da sua página.",
        ],
      },
      {
        title: "Gratuito e sem garantia",
        paragraphs: [
          "O Reunião é oferecido de graça, como está. Fazemos o possível para que funcione bem, mas não garantimos que estará sempre disponível ou sem erros. Podemos mudar, suspender ou encerrar o serviço; se for encerrado, avisaremos com antecedência razoável para você se organizar.",
        ],
      },
      {
        title: "Uso permitido",
        paragraphs: [
          "Não é permitido usar o Reunião para enviar spam, enganar pessoas, se passar por outra pessoa ou empresa, coletar dados de terceiros sem base legal, fazer qualquer coisa ilegal ou tentar burlar a segurança ou os limites do serviço.",
        ],
      },
      {
        title: "Dados das pessoas que marcam com você",
        paragraphs: [
          "Você é o responsável (controlador) pelos dados das pessoas que marcam reunião pela sua página, e o Reunião os trata em seu nome, como descrito na Política de privacidade. Use esses dados só para as reuniões.",
        ],
      },
      {
        title: "Suspensão e exclusão",
        paragraphs: [
          "Podemos suspender ou excluir contas que violem estes Termos ou coloquem o serviço ou outras pessoas em risco. Você pode excluir a sua conta quando quiser, em Conta, no painel.",
        ],
      },
      {
        title: "Responsabilidade",
        paragraphs: [
          "Na medida permitida pela lei, a DabLab não responde por perdas causadas por reuniões não realizadas, horários marcados com informações erradas, falhas do Google, do e-mail ou de outros serviços de terceiros, nem pelo conteúdo que os usuários publicam.",
        ],
      },
      {
        title: "Mudanças nestes Termos",
        paragraphs: [
          "Se estes Termos mudarem de forma importante, avisaremos por e-mail ou no próprio Reunião. Continuar usando depois do aviso significa aceitar a nova versão.",
        ],
      },
      {
        title: "Lei e foro",
        paragraphs: [
          "Estes Termos seguem as leis do Brasil. Fica eleito o foro da comarca de São Paulo/SP, ressalvado o direito do consumidor de propor ação no foro do seu domicílio.",
          "Dúvidas: alexandre@dablab.com.br.",
        ],
      },
    ],
  },
  welcome: {
    // Boas-vindas do primeiro acesso (spec v0.5, 8.11). A aprovar.
    title: "Boas-vindas ao Reunião",
    intro: "Confira como você vai aparecer para quem marcar reunião com você. Dá para mudar tudo depois, em Conta.",
    acceptBefore: "Li e aceito os ",
    acceptBetween: " e a ",
    submit: "Começar",
    // Saída das boas-vindas (bug B-02). A aprovar.
    signOut: "Sair",
    decline: "Não quero usar o Reunião",
    declineConfirm: "Isso apaga a sua conta e desconecta o Google. Continuar?",
    declineButton: "Excluir minha conta",
    cancel: "Cancelar",
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
    reuniao_iniciada: "Esta reunião já aconteceu ou está acontecendo.",
    transicao_invalida: "Esta reunião não pode mais ser alterada.", // a aprovar (8.6)
    limite_tentativas: "Este e-mail já foi tentado 5 vezes.", // a aprovar (8.7)
    slug_reservado: "Esse endereço é reservado. Escolha outro.", // a aprovar (8.8)
    confirmacao_invalida: "O endereço digitado não confere.", // a aprovar (8.8)
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
