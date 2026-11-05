// [Convidado] Confirmado — /{slug}/{tipo}/confirmado?r={id} (seção 10, épico 8.5).
// Mostra "Reunião marcada.", tipo, data e hora no fuso do convidado, Meet e o aviso de e-mail.
// Só com o cookie curto ag_confirmacao que bate com ?r= (o id sozinho não abre nada) → senão 404.
import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";
import { formatDateTimeLong, timeZoneName } from "@/lib/format";
import { CONFIRMATION_COOKIE, confirmationMatches } from "@/server/auth/confirmation";
import { getConfirmedReservation } from "@/server/db/public";

// Confere o cookie, lê a reserva confirmada e monta o resumo.
async function ConfirmedContent({ params, searchParams }: {
  params: PageProps<"/[slug]/[tipo]/confirmado">["params"];
  searchParams: PageProps<"/[slug]/[tipo]/confirmado">["searchParams"];
}) {
  const [{ slug }, { r }, jar] = await Promise.all([params, searchParams, cookies()]);
  const id = typeof r === "string" ? r : "";
  if (!id || !(await confirmationMatches(jar.get(CONFIRMATION_COOKIE)?.value, id))) notFound();
  const reserva = await getConfirmedReservation(id);
  if (!reserva || reserva.ag_contas?.slug !== slug) notFound();
  return (
    <div className={`${styles.card} ${styles.cardNarrow} ${styles.done}`}>
      <span className={styles.doneIcon}><Check size={28} strokeWidth={2.5} aria-hidden="true" /></span>
      <h1 className={styles.doneTitle}>{copy.booking.confirmedTitle}</h1>
      <div className={styles.doneDetails}>
        <strong>{reserva.ag_tipos_evento?.nome} · {reserva.ag_contas?.nome_exibicao}</strong>
        <span>{formatDateTimeLong(reserva.inicio, reserva.fuso_convidado)} ({timeZoneName(reserva.fuso_convidado)})</span>
        {reserva.link_meet && <a href={reserva.link_meet} target="_blank" rel="noreferrer">{reserva.link_meet}</a>}
      </div>
      <p className={styles.doneNote}>{copy.booking.confirmedBody.replace("{email}", reserva.email_convidado)}</p>
    </div>
  );
}

// Página: fundo cinza e o cartão de confirmação.
export default function ConfirmedPage({ params, searchParams }: PageProps<"/[slug]/[tipo]/confirmado">) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={`${styles.card} ${styles.cardNarrow}`} aria-busy="true" />}>
        <ConfirmedContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
