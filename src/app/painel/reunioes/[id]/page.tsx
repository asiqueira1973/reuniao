// [Dono] Detalhe da reunião — /painel/reunioes/[id] (seção 10, épico 8.7): convidado, tipo,
// horário, Meet, observação, histórico de remarcação, situação dos e-mails ("E-mail não enviado"
// + "Reenviar") e "Cancelar reunião" (só confirmada e futura). Outra conta → 404.
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { CancelMeeting, ResendButton } from "@/features/meetings/components/meeting-actions";
import styles from "@/features/meetings/components/meetings.module.css";
import { copy } from "@/lib/copy";
import { formatDateTimeLong } from "@/lib/format";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getHolidayState } from "@/server/db/availability";
import { getMeeting } from "@/server/db/meetings";
import painel from "../../painel.module.css";

const t = copy.meetings;

// Carrega a reunião da conta da sessão e monta o detalhe.
async function MeetingContent({ params }: { params: PageProps<"/painel/reunioes/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  if (!z.uuid().safeParse(id).success) notFound();
  const [m, { fuso }] = await Promise.all([getMeeting(account.id, id), getHolidayState(account.id)]);
  if (!m) notFound();
  const when = (iso: string) => formatDateTimeLong(new Date(iso).toISOString(), fuso);
  const future = new Date(m.inicio) > new Date();
  const fields: [string, React.ReactNode][] = [
    [copy.emails.type, m.tipo],
    [copy.emails.when, when(m.inicio)],
    [copy.emails.guest, `${m.nome_convidado} (${m.email_convidado})`],
  ];
  if (m.link_meet && m.status === "confirmada") fields.push([t.meet, <a key="meet" href={m.link_meet} target="_blank" rel="noreferrer">{m.link_meet}</a>]);
  if (m.observacao) fields.push([t.notes, m.observacao]);
  for (const h of m.historico) fields.push(["", t.rescheduledFrom.replace("{quando}", when(h))]);
  if (m.cancelada_em) fields.push(["", t.cancelledAt.replace("{quando}", when(m.cancelada_em))]);
  if (m.motivo_cancelamento) fields.push([t.reason, m.motivo_cancelamento]);

  return (
    <>
      <div className={painel.pageHeader}>
        <h1 className={painel.pageTitle}>{m.nome_convidado}</h1>
      </div>
      <div className={styles.card}>
        {fields.map(([label, value], i) => (
          <div key={i} className={styles.field}>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>{value}</span>
          </div>
        ))}
      </div>
      {m.notificacoes.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.emails}</h2>
          <ul className={styles.notes}>
            {m.notificacoes.map((n) => (
              <li key={n.id} className={styles.note}>
                <span>{t.notificationTypes[n.tipo as keyof typeof t.notificationTypes] ?? n.tipo}</span>
                {n.status === "enviada" ? (
                  <span className={styles.noteOk}>{t.emailSent}</span>
                ) : (
                  <span>
                    <span className={styles.noteFailed}>{n.status === "falhou" ? t.emailFailed : t.emailPending} </span>
                    <ResendButton id={n.id} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {m.status === "confirmada" && future && (
        <div className={styles.actions}>
          <CancelMeeting id={m.id} />
        </div>
      )}
    </>
  );
}

// Página: link de volta e o detalhe (carrega em streaming).
export default function MeetingPage({ params }: PageProps<"/painel/reunioes/[id]">) {
  return (
    <>
      <Link href="/painel/reunioes" className={styles.back}>
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />{t.back}
      </Link>
      <Suspense fallback={<div className={styles.card} aria-busy="true" />}>
        <MeetingContent params={params} />
      </Suspense>
    </>
  );
}
