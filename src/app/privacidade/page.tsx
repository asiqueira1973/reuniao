// [Público] Política de privacidade — seção 20 e spec v0.5 (épico 8.12): política completa em nome
// da DabLab. Com ?de={slug}, mostra antes o bloco "Sobre esta agenda", com o contato do dono
// daquela página (pergunta 25.3).
import Link from "next/link";
import { Suspense } from "react";
import { LegalPage } from "@/components/legal/legal-page";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";
import { isValidSlug } from "@/lib/slug";
import { getPrivacyContact } from "@/server/db/public";

const t = copy.privacy;

// Troca {chave} pelo valor.
function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
}

// Bloco do dono da página de onde o convidado veio (só com ?de= válido e existente).
async function AboutThisPage({ searchParams }: { searchParams: PageProps<"/privacidade">["searchParams"] }) {
  const de = (await searchParams).de;
  const slug = typeof de === "string" && isValidSlug(de) ? de : null;
  const contact = slug ? await getPrivacyContact(slug) : null;
  if (!slug || !contact) return null;
  const dono = contact.nome_exibicao;
  return (
    <section className={styles.legalBox}>
      <h2 className={styles.legalHeading}>{t.aboutThisPage}</h2>
      <p>{fill(t.collected, { dono })}</p>
      <p>{fill(t.calendar, { dono })}</p>
      <p>{fill(t.retention, { dono })}</p>
      <p>{t.contact} <a href={`mailto:${contact.email}`}>{contact.email}</a>.</p>
      <p><Link href={`/${slug}`}>{t.back}</Link></p>
    </section>
  );
}

export default function PrivacyPage({ searchParams }: PageProps<"/privacidade">) {
  return (
    <LegalPage
      title={copy.legal.privacy}
      sections={copy.legal.privacySections}
      before={<Suspense fallback={null}><AboutThisPage searchParams={searchParams} /></Suspense>}
    />
  );
}
