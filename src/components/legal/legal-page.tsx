// Página de texto legal (Termos e Privacidade, spec v0.5, épico 8.12): título, data de
// atualização e seções com parágrafos. O conteúdo vem de copy.legal. `before` permite inserir um
// bloco no topo (o contato do dono na /privacidade?de={slug}).
import Link from "next/link";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";

type Section = { title: string; paragraphs: readonly string[] };

export function LegalPage({ title, sections, before }: { title: string; sections: readonly Section[]; before?: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <article className={`${styles.card} ${styles.cardNarrow} ${styles.prose}`}>
        <h1 className={styles.ownerName}>{title}</h1>
        <p className={styles.legalUpdated}>{copy.legal.updated}</p>
        {before}
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className={styles.legalHeading}>{s.title}</h2>
            {s.paragraphs.map((p) => <p key={p}>{p}</p>)}
          </section>
        ))}
      </article>
      <LegalFooter />
    </main>
  );
}

// Rodapé das páginas institucionais: Privacidade · Termos · Um produto DabLab.
export function LegalFooter() {
  return (
    <footer className={styles.footer}>
      <Link href="/privacidade">{copy.legal.privacy}</Link>
      {" · "}
      <Link href="/termos">{copy.legal.terms}</Link>
      {" · "}
      <a href="https://dablab.com.br" rel="noopener">{copy.home.madeBy}</a>
    </footer>
  );
}
