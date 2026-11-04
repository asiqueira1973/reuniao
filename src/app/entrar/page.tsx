// [Público] Entrar — seção 10 e épico 8.1: botão "Entrar com Google" e mensagens de erro de acesso.
// O botão é um link para GET /api/auth/google (inicia o OAuth). O erro vem de ?erro=… e, com
// Cache Components, é lido dentro de <Suspense>.
import { Suspense } from "react";
import { copy, isLoginErrorCode } from "@/lib/copy";
import styles from "./entrar.module.css";

// Mostra a mensagem do código de erro da URL, se for um código conhecido.
async function LoginError({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { erro } = await searchParams;
  if (!isLoginErrorCode(erro)) return null;
  return (
    <p className={styles.error} role="alert">
      {copy.login.errors[erro]}
    </p>
  );
}

export default function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>{copy.appName}</h1>
        <Suspense fallback={null}>
          <LoginError searchParams={searchParams} />
        </Suspense>
        <a className={styles.google} href="/api/auth/google">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          {copy.login.button}
        </a>
      </div>
    </main>
  );
}
