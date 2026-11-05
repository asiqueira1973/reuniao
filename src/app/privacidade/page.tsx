// [Convidado] Privacidade — seção 20 (LGPD): o que é guardado, por quanto tempo e a quem pedir a
// exclusão. /privacidade?de={slug}: o contato é o e-mail da conta daquela página (pergunta 25.3).
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";
import { isValidSlug } from "@/lib/slug";
import { getPrivacyContact } from "@/server/db/public";

const t = copy.privacy;

// Troca {chave} pelo valor.
function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
}

// Lê a conta indicada em ?de= e monta o texto com o nome e o e-mail do dono.
async function PrivacyContent({ searchParams }: { searchParams: PageProps<"/privacidade">["searchParams"] }) {
  const de = (await searchParams).de;
  const slug = typeof de === "string" && isValidSlug(de) ? de : null;
  const contact = slug ? await getPrivacyContact(slug) : null;
  const dono = contact?.nome_exibicao ?? t.ownerFallback;
  return (
    <>
      <p>{fill(t.collected, { dono })}</p>
      <p>{fill(t.calendar, { dono })}</p>
      <p>{t.retention}</p>
      <p>{contact ? <>{t.contact} <a href={`mailto:${contact.email}`}>{contact.email}</a>.</> : t.contactGeneric}</p>
      {slug && contact ? <p><Link href={`/${slug}`}>{t.back}</Link></p> : null}
    </>
  );
}

export default function PrivacyPage({ searchParams }: PageProps<"/privacidade">) {
  return (
    <main className={styles.page}>
      <article className={`${styles.card} ${styles.cardNarrow} ${styles.prose}`}>
        <h1 className={styles.ownerName}>{t.title}</h1>
        <Suspense fallback={null}>
          <PrivacyContent searchParams={searchParams} />
        </Suspense>
      </article>
    </main>
  );
}
