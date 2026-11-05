// [Convidado] Página da conta — /{slug} (seção 10, épico 8.5): nome do dono, mensagem de
// boas-vindas (ou "Escolha um tipo de reunião.") e os tipos visíveis e ativos. Conta inexistente → 404.
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";
import { formatDuration } from "@/lib/format";
import { getPublicAccount, listPublicEventTypes } from "@/server/db/public";

// Carrega a conta e os tipos que aparecem na página.
async function AccountContent({ params }: { params: PageProps<"/[slug]">["params"] }) {
  const { slug } = await params;
  const conta = await getPublicAccount(slug);
  if (!conta) notFound();
  const types = await listPublicEventTypes(conta.id);
  return (
    <div className={`${styles.card} ${styles.cardNarrow}`}>
      <h1 className={styles.ownerName}>{conta.nome_exibicao}</h1>
      <p className={styles.welcome}>{conta.mensagem_boas_vindas || copy.booking.chooseType}</p>
      <ul className={styles.typeList}>
        {types.map((t) => (
          <li key={t.id}>
            <Link className={styles.typeLink} href={`/${conta.slug}/${t.slug}`}>
              <span className={styles.typeMain}>
                <span className={styles.typeName}>{t.nome}</span>
                <span className={styles.typeMeta}>{formatDuration(t.duracao_min)}{t.com_meet ? ` · ${copy.booking.meet}` : ""}</span>
              </span>
              <ChevronRight className={styles.chevron} size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Página: fundo cinza e o cartão da conta (carrega em streaming).
export default function AccountPage({ params }: PageProps<"/[slug]">) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={`${styles.card} ${styles.cardNarrow}`} aria-busy="true" />}>
        <AccountContent params={params} />
      </Suspense>
    </main>
  );
}
