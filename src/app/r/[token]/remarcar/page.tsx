// [Convidado] Remarcar — /r/{token}/remarcar (seção 10, épico 8.6): mesmo calendário do 8.5,
// sem pedir nome e e-mail de novo, com "Confirmar novo horário". Só para reserva confirmada que
// ainda não começou; nos outros casos volta para a tela de gestão com o estado.
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { addDays } from "@/features/availability/holidays";
import { BookingFlow } from "@/features/booking/components/booking-flow";
import styles from "@/features/booking/components/public.module.css";
import { todayIn } from "@/server/db/availability";
import { getManageView } from "@/server/manage";
import { getPublicEventType } from "@/server/db/public";

// Confere a reserva e monta o calendário em modo remarcação.
async function RescheduleContent({ params }: { params: PageProps<"/r/[token]/remarcar">["params"] }) {
  const { token } = await params;
  // "Agora" decide se a reunião já começou: a página é sempre por requisição.
  await connection();
  const view = await getManageView(token);
  if (view.state !== "active") redirect(`/r/${token}`);
  const r = view.r;
  const conta = r.ag_contas!;
  const tipo = await getPublicEventType(r.conta_id, r.ag_tipos_evento!.slug);
  if (!tipo) redirect(`/r/${token}`);
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
        reschedule={{ token, currentStart: new Date(r.inicio).toISOString() }}
      />
    </div>
  );
}

// Página: fundo cinza e o calendário (carrega em streaming).
export default function ReschedulePage({ params }: PageProps<"/r/[token]/remarcar">) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={styles.card} aria-busy="true"><div className={styles.skeleton} /></div>}>
        <RescheduleContent params={params} />
      </Suspense>
    </main>
  );
}
