// [Público] Página inicial — spec v0.5, épico 8.12: o que é o Reunião, "Entrar com Google" e
// rodapé com Privacidade, Termos e DabLab. Quem tem sessão é mandado ao painel pelo proxy.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalFooter } from "@/components/legal/legal-page";
import { copy } from "@/lib/copy";
import styles from "./home.module.css";

// Página institucional: legível por robôs (bug B-03, revisão do OAuth do Google). O layout raiz
// continua noindex para o resto do app.
export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function HomePage() {
  const t = copy.home;
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.brand}>{copy.appName}</p>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>
        <Link className={styles.cta} href="/entrar">{t.cta}</Link>
      </section>
      <ul className={styles.features}>
        {t.features.map((f) => (
          <li key={f.title} className={styles.feature}>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </li>
        ))}
      </ul>
      <LegalFooter />
    </main>
  );
}
