// [Dono] Reuniões — /painel/reunioes?aba= (seção 10, épico 8.7): abas Próximas, Passadas e
// Canceladas; agrupado por dia no fuso da conta; linha com hora, convidado, tipo e e-mail; toque
// abre o detalhe. Estado vazio: "Nenhuma reunião marcada." Dados filtrados por conta_id.
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { localDate, localTime } from "@/features/availability/group";
import styles from "@/features/meetings/components/meetings.module.css";
import { copy } from "@/lib/copy";
import { formatDateLong } from "@/lib/format";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getHolidayState } from "@/server/db/availability";
import { listMeetings, MEETING_TABS, type MeetingRow, type MeetingTab } from "@/server/db/meetings";
import painel from "../painel.module.css";

const t = copy.meetings;

// Agrupa as reuniões por data no fuso da conta, mantendo a ordem da aba.
function groupByDay(rows: MeetingRow[], timeZone: string): [string, MeetingRow[]][] {
  const out = new Map<string, MeetingRow[]>();
  for (const r of rows) {
    const day = localDate(new Date(r.inicio).toISOString(), timeZone);
    out.set(day, [...(out.get(day) ?? []), r]);
  }
  return [...out.entries()];
}

// Carrega a aba pedida e monta as abas e a lista.
async function MeetingsContent({ searchParams }: { searchParams: PageProps<"/painel/reunioes">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  const tab: MeetingTab = MEETING_TABS.includes(sp.aba as MeetingTab) ? (sp.aba as MeetingTab) : "proximas";
  const page = Math.max(0, Number(sp.pagina ?? "0") || 0);
  const [{ fuso }, { rows, hasMore }] = await Promise.all([getHolidayState(account.id), listMeetings(account.id, tab, new Date(), page)]);
  const year = Number(localDate(new Date().toISOString(), fuso).slice(0, 4));

  return (
    <>
      <nav className={styles.tabs} aria-label={t.title}>
        {MEETING_TABS.map((k) => (
          <Link key={k} href={`/painel/reunioes?aba=${k}`} className={`${styles.tab} ${k === tab ? styles.tabActive : ""}`} aria-current={k === tab ? "page" : undefined}>
            {t.tabs[k]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t.empty}</p>
      ) : (
        groupByDay(rows, fuso).map(([day, items]) => (
          <section key={day} className={styles.group}>
            <h2 className={styles.day}>{formatDateLong(day, year)}</h2>
            <ul className={styles.list}>
              {items.map((r) => (
                <li key={r.id} className={styles.item}>
                  <Link href={`/painel/reunioes/${r.id}`} className={styles.row}>
                    <span className={styles.time}>{localTime(new Date(r.inicio).toISOString(), fuso)}</span>
                    <span className={styles.main}>
                      <span className={styles.name}>{r.nome_convidado}</span>
                      <span className={styles.meta}>{r.tipo} · {r.email_convidado}</span>
                    </span>
                    <span className={`${styles.badge} ${r.status === "confirmada" ? styles.badgeOk : styles.badgeCancelled}`}>
                      {r.status === "confirmada" ? t.confirmed : t.cancelledStatus}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {hasMore && <Link className={styles.more} href={`/painel/reunioes?aba=${tab}&pagina=${page + 1}`}>{t.loadMore}</Link>}
    </>
  );
}

// Página: título e a aba (carrega em streaming).
export default function MeetingsPage({ searchParams }: PageProps<"/painel/reunioes">) {
  return (
    <>
      <div className={painel.pageHeader}>
        <h1 className={painel.pageTitle}>{t.title}</h1>
      </div>
      <Suspense fallback={<p className={styles.empty} aria-busy="true" />}>
        <MeetingsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
