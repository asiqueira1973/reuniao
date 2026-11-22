// [Dono] Autorizar assistente — plano 9.6. Exige sessão (sem ela, vai para /entrar e volta para
// cá) e o primeiro acesso concluído. Mostra o nome do cliente, o que ele poderá e não poderá fazer
// e o host de volta. "Permitir" e "Cancelar" enviam o formulário para /oauth/autorizar/decidir,
// que confere tudo de novo. Pedido inválido → tela de erro, sem redirecionar.
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import styles from "@/features/oauth/oauth.module.css";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { AUTHORIZE_PARAMS, checkAuthorizeParams, redirectHost } from "@/server/oauth/authorize";

type Props = PageProps<"/oauth/autorizar">;

async function Consent({ searchParams }: Props) {
  const sp = await searchParams;
  const p = Object.fromEntries(AUTHORIZE_PARAMS.map((k) => [k, typeof sp[k] === "string" ? (sp[k] as string) : undefined]));
  const check = await checkAuthorizeParams(p);
  if (!check.ok) {
    return (
      <div className={styles.card} role="alert">
        <p className={styles.brand}>{copy.appName}</p>
        <h1 className={styles.title}>{copy.oauth.invalidTitle}</h1>
        <p className={styles.muted}>{copy.oauth.invalidText}</p>
      </div>
    );
  }
  const account = await getCurrentAccount();
  const query = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();
  if (!account) redirect(`/entrar?volta=${encodeURIComponent(`/oauth/autorizar?${query}`)}`);
  if (!account.termsAcceptedAt) {
    return (
      <div className={styles.card}>
        <p className={styles.brand}>{copy.appName}</p>
        <h1 className={styles.title}>{copy.oauth.title(check.req.client.nome)}</h1>
        <p className={styles.text}>{copy.oauth.welcomeFirst}</p>
        <Link className={styles.primary} href="/painel/tipos">{copy.oauth.goToPanel}</Link>
      </div>
    );
  }
  return (
    <form className={styles.card} method="post" action="/oauth/autorizar/decidir">
      <p className={styles.brand}>{copy.appName}</p>
      <h1 className={styles.title}>{copy.oauth.title(check.req.client.nome)}</h1>
      <p className={styles.text}>{copy.oauth.can}</p>
      <p className={styles.text}>{copy.oauth.cannot}</p>
      <p className={styles.muted}>{copy.oauth.returnTo(redirectHost(check.req.redirectUri))}</p>
      <p className={styles.muted}>{copy.oauth.as(account.email)}</p>
      {AUTHORIZE_PARAMS.map((k) => (p[k] ? <input key={k} type="hidden" name={k} value={p[k]} /> : null))}
      <div className={styles.buttons}>
        <button className={styles.secondary} type="submit" name="decisao" value="cancelar">{copy.oauth.cancel}</button>
        <button className={styles.primary} type="submit" name="decisao" value="permitir">{copy.oauth.allow}</button>
      </div>
    </form>
  );
}

export default function AutorizarPage(props: Props) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={styles.card} aria-busy="true" />}>
        <Consent {...props} />
      </Suspense>
    </main>
  );
}
