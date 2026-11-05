// [Convidado] Gerenciar reserva — /r/{token} (seção 10, épico 8.6): "Sua reunião" com tipo,
// data e hora no fuso do convidado e Meet, mais Remarcar e Cancelar reunião. Estados: link
// inválido, cancelada, remarcada (com a data nova) e já começou (sem botões). noindex e
// Referrer-Policy: no-referrer vêm do next.config.ts (seção 20).
import { Suspense } from "react";
import { connection } from "next/server";
import { ManageActions } from "@/features/booking/components/manage-actions";
import styles from "@/features/booking/components/public.module.css";
import { copy } from "@/lib/copy";
import { formatDateTimeLong, timeZoneName } from "@/lib/format";
import { getManageView } from "@/server/manage";

const m = copy.manage;

// Monta a tela conforme o estado da reserva do token.
async function ManageContent({ params }: { params: PageProps<"/r/[token]">["params"] }) {
  const { token } = await params;
  // "Agora" decide se a reunião já começou: a página é sempre por requisição.
  await connection();
  const view = await getManageView(token);
  if (view.state === "invalid") {
    return <p className={styles.welcome}>{m.invalidLink}</p>;
  }
  const r = view.r;
  const when = `${formatDateTimeLong(new Date(r.inicio).toISOString(), r.fuso_convidado)} (${timeZoneName(r.fuso_convidado)})`;
  return (
    <>
      <h1 className={styles.manageTitle}>{m.title}</h1>
      <div className={styles.manageDetails}>
        <strong>{r.ag_tipos_evento!.nome} · {r.ag_contas!.nome_exibicao}</strong>
        <span>{when}</span>
        {r.link_meet && view.state === "active" && <a href={r.link_meet} target="_blank" rel="noreferrer">{r.link_meet}</a>}
      </div>
      {view.state === "active" && <ManageActions token={token} />}
      {view.state === "past" && <p className={styles.message}>{m.past}</p>}
      {view.state === "cancelled" && <p className={styles.message}>{m.wasCancelled}</p>}
      {view.state === "rescheduled" && (
        <p className={styles.message}>
          {m.wasRescheduled.replace("{quando}", view.newStart ? formatDateTimeLong(new Date(view.newStart).toISOString(), r.fuso_convidado) : "—")}
        </p>
      )}
    </>
  );
}

// Página: cartão central (carrega em streaming).
export default function ManagePage({ params }: PageProps<"/r/[token]">) {
  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${styles.cardNarrow}`}>
        <Suspense fallback={<div className={styles.skeleton} aria-busy="true" />}>
          <ManageContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}
