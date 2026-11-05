// [Convidado] Escolher horário — /{slug}/{tipo} (seção 10, épico 8.5). O servidor confere conta e
// tipo (inexistente ou excluído → 404; inativo → "Este tipo de reunião não está disponível.") e
// entrega o fluxo ao cliente; os horários vêm de GET /api/disponibilidade.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { addDays } from "@/features/availability/holidays";
import { BookingFlow } from "@/features/booking/components/booking-flow";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";
import { todayIn } from "@/server/db/availability";
import { getPublicAccount, getPublicEventType } from "@/server/db/public";

// Carrega conta e tipo e monta o fluxo (ou a mensagem de tipo inativo).
async function TypeContent({ params }: { params: PageProps<"/[slug]/[tipo]">["params"] }) {
  const { slug, tipo: typeSlug } = await params;
  const conta = await getPublicAccount(slug);
  if (!conta) notFound();
  const tipo = await getPublicEventType(conta.id, typeSlug);
  if (!tipo) notFound();
  if (!tipo.ativo) {
    return (
      <div className={`${styles.card} ${styles.cardNarrow}`}>
        <h1 className={styles.ownerName}>{conta.nome_exibicao}</h1>
        <p className={styles.welcome}>{copy.booking.typeInactive}</p>
      </div>
    );
  }
  const today = todayIn(conta.fuso);
  return (
    <div className={styles.card}>
      <BookingFlow
        accountSlug={conta.slug}
        typeSlug={tipo.slug}
        ownerName={conta.nome_exibicao}
        typeName={tipo.nome}
        durationMin={tipo.duracao_min}
        withMeet={tipo.com_meet}
        description={tipo.descricao}
        accountTimeZone={conta.fuso}
        todayAccount={today}
        windowEnd={addDays(today, tipo.janela_dias - 1)}
      />
    </div>
  );
}

// Página: fundo cinza e o cartão de reserva (carrega em streaming).
export default function TypePage({ params }: PageProps<"/[slug]/[tipo]">) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={styles.card} aria-busy="true"><div className={styles.skeleton} /></div>}>
        <TypeContent params={params} />
      </Suspense>
    </main>
  );
}
