// Textos oficiais do produto — seção 15 (conteúdo final, pt-BR). Nenhum texto de interface fora daqui.
// Cresce a cada épico; as chaves de erro espelham os códigos da seção 13.

export const copy = {
  appName: "Minha Agenda",
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
    signOut: "Sair",
    viewMyPage: "Ver minha página",
  },
} as const;

export type LoginErrorCode = keyof typeof copy.login.errors;

// Diz se o valor vindo da URL é um código de erro de login conhecido.
export function isLoginErrorCode(v: unknown): v is LoginErrorCode {
  return typeof v === "string" && v in copy.login.errors;
}
