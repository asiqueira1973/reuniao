"use client";
// Escolher horário e reservar — épico 8.5 e seção 10 ([Convidado] Escolher horário).
// Calendário do mês (dias com horário em azul, hoje com ponto), fuso do convidado detectado e
// trocável (a troca só reagrupa; não chama o servidor), lista de horários do dia, "Próximo",
// formulário (Nome, E-mail, observação, honeypot) e POST /api/reservas. Abre no primeiro mês com
// horário dentro da janela. Estados: carregando, mês vazio, erro do Google, agenda revogada,
// horário tomado, falha ao criar, limite.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Clock, Video } from "lucide-react";
import { addDays } from "@/features/availability/holidays";
import { groupByLocalDate, localDate, localTime } from "@/features/availability/group";
import { copy } from "@/lib/copy";
import { formatDateLong, formatDuration, timeZoneName } from "@/lib/format";
import styles from "./public.module.css";

type Props = {
  accountSlug: string;
  typeSlug: string;
  ownerName: string;
  typeName: string;
  durationMin: number;
  withMeet: boolean;
  description: string | null;
  accountTimeZone: string;
  todayAccount: string;
  windowEnd: string;
};

type MonthState =
  | { status: "loading" }
  | { status: "ok"; slots: string[] }
  | { status: "error"; message: string };

const b = copy.booking;

// "AAAA-MM" do primeiro dia de um mês deslocado.
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Último dia (AAAA-MM-DD) de um mês "AAAA-MM".
function lastDayOf(ym: string): string {
  return addDays(`${shiftMonth(ym, 1)}-01`, -1);
}

// Nome do mês ("novembro de 2026") e rótulos dos dias da semana (dom. … sáb.).
function monthLabel(ym: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-15T12:00:00Z`));
}
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + i, 12))),
);

// Texto de erro da consulta de horários (seção 15).
function availabilityError(code: unknown): string {
  if (code === "agenda_indisponivel") return b.agendaRevoked;
  if (code === "tipo_indisponivel") return b.typeInactive;
  return b.googleError;
}

// Fuso do navegador (regra 11.1). No servidor (e na hidratação) vale o fuso da conta.
const noSubscribe = () => () => {};
function useBrowserTimeZone(fallback: string): string {
  return useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || fallback, () => fallback);
}

// true só no navegador, depois da hidratação (nomes de fuso variam entre servidor e navegador).
function useIsClient(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

// Fluxo completo: escolher dia e horário, preencher os dados e confirmar.
export function BookingFlow(p: Props) {
  const router = useRouter();
  const detectedTz = useBrowserTimeZone(p.accountTimeZone);
  const [chosenTz, setTz] = useState<string | null>(null);
  const tz = chosenTz ?? detectedTz;
  const tzRef = useRef(tz);
  useEffect(() => {
    tzRef.current = tz;
  }, [tz]);
  const [month, setMonth] = useState(p.todayAccount.slice(0, 7));
  const [months, setMonths] = useState<Record<string, MonthState>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const autoAdvance = useRef(true);

  // Busca os horários do mês (com 1 dia de folga em cada ponta, para cobrir a troca de fuso).
  // No carregamento inicial, mês sem horário avança sozinho até o fim da janela.
  const load = useCallback(async (ym: string) => {
    const de = addDays(`${ym}-01`, -1);
    const ate = addDays(lastDayOf(ym), 1);
    const qs = new URLSearchParams({ conta: p.accountSlug, tipo: p.typeSlug, de, ate });
    const res = await fetch(`/api/disponibilidade?${qs}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      const code = res ? (await res.json().catch(() => ({}))).erro : null;
      setMonths((m) => ({ ...m, [ym]: { status: "error", message: availabilityError(code) } }));
      return;
    }
    const body = (await res.json()) as { dias: { horarios: string[] }[] };
    const slots = body.dias.flatMap((d) => d.horarios);
    setMonths((m) => ({ ...m, [ym]: { status: "ok", slots } }));
    if (autoAdvance.current) {
      const inMonth = slots.some((iso) => localDate(iso, tzRef.current).startsWith(ym));
      const next = shiftMonth(ym, 1);
      if (!inMonth && `${next}-01` <= p.windowEnd) setMonth(next);
      else autoAdvance.current = false;
    }
  }, [p.accountSlug, p.typeSlug, p.windowEnd]);

  // Busca o mês exibido quando ainda não foi buscado (o resultado chega depois, de forma assíncrona).
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (requested.current.has(month)) return;
    requested.current.add(month);
    void load(month);
  }, [month, load]);

  const state = months[month];
  // Horários do mês agrupados pela data local do convidado, só os que caem neste mês.
  const byDate = useMemo(() => {
    if (state?.status !== "ok") return {};
    const grouped = groupByLocalDate(state.slots, tz);
    return Object.fromEntries(Object.entries(grouped).filter(([d]) => d.startsWith(month)));
  }, [state, tz, month]);

  const canGoBack = month > p.todayAccount.slice(0, 7);
  const canGoNext = `${shiftMonth(month, 1)}-01` <= p.windowEnd;

  // Navegação manual entre meses.
  function go(delta: number) {
    autoAdvance.current = false;
    setSelectedDate(null);
    setSelectedSlot(null);
    setNotice(null);
    setMonth((m) => shiftMonth(m, delta));
  }

  const todayGuest = localDate(new Date().toISOString(), tz);
  const firstWeekday = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const daysInMonth = Number(lastDayOf(month).slice(8, 10));
  const daySlots = selectedDate ? byDate[selectedDate] ?? [] : [];

  // Envia a reserva e trata as respostas da seção 13.
  async function submit(form: HTMLFormElement) {
    if (!selectedSlot) return;
    const data = new FormData(form);
    setSending(true);
    setNotice(null);
    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conta: p.accountSlug,
        tipo: p.typeSlug,
        inicio: selectedSlot,
        nome: String(data.get("nome") ?? ""),
        email: String(data.get("email") ?? ""),
        observacao: String(data.get("observacao") ?? "") || null,
        fuso: tz,
        site: String(data.get("site") ?? ""),
      }),
    }).catch(() => null);
    if (res?.status === 201) {
      // Continua "enviando" até a navegação, para um segundo clique não reenviar.
      const { id } = (await res.json()) as { id: string };
      router.push(`/${p.accountSlug}/${p.typeSlug}/confirmado?r=${id}`);
      return;
    }
    setSending(false);
    const code = res ? (await res.json().catch(() => ({}))).erro : null;
    if (code === "horario_indisponivel") {
      setStep("pick");
      setSelectedSlot(null);
      setNotice({ text: b.slotTaken, error: true });
      void load(month);
    } else if (code === "limite_excedido") setNotice({ text: b.limit, error: true });
    else if (code === "dados_invalidos") setNotice({ text: b.invalidFields, error: true });
    else if (code === "agenda_indisponivel") setNotice({ text: b.agendaRevoked, error: true });
    else if (code === "tipo_indisponivel") setNotice({ text: b.typeInactive, error: true });
    else setNotice({ text: b.createFailed, error: true });
  }

  const isClient = useIsClient();
  const tzOptions = useMemo(() => {
    if (!isClient) return [{ value: tz, label: tz }];
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [p.accountTimeZone];
    const list = all.includes(tz) ? all : [tz, ...all];
    return list.map((z) => ({ value: z, label: `${z.split("/").pop()!.replace(/_/g, " ")} — ${timeZoneName(z)}` })).sort((a, c) => a.label.localeCompare(c.label, "pt-BR"));
  }, [tz, p.accountTimeZone, isClient]);

  return (
    <div className={styles.layout}>
      <aside className={styles.summary}>
        <p className={styles.summaryOwner}>{p.ownerName}</p>
        <h1 className={styles.summaryTitle}>{p.typeName}</h1>
        <p className={styles.summaryRow}><Clock size={18} strokeWidth={1.75} aria-hidden="true" />{formatDuration(p.durationMin)}</p>
        {p.withMeet && <p className={styles.summaryRow}><Video size={18} strokeWidth={1.75} aria-hidden="true" />{b.meet}</p>}
        {p.description && <p className={styles.summaryDesc}>{p.description}</p>}
      </aside>

      <section className={styles.picker}>
        {step === "form" && selectedSlot ? (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}>
            <button type="button" className={styles.back} onClick={() => { setStep("pick"); setNotice(null); }}>
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />{b.back}
            </button>
            <h2 className={styles.pickerTitle}>{b.formTitle}</h2>
            <p className={styles.chosen}>
              {formatDateLong(localDate(selectedSlot, tz))}, {localTime(selectedSlot, tz)} ({timeZoneName(tz)})
            </p>
            <label className={styles.field}>{b.name}<input className={styles.input} name="nome" required maxLength={100} autoComplete="name" /></label>
            <label className={styles.field}>{b.email}<input className={styles.input} name="email" type="email" required maxLength={254} autoComplete="email" /></label>
            <label className={styles.field}>{b.notes}<textarea className={styles.textarea} name="observacao" maxLength={1000} /></label>
            <div className={styles.honeypot} aria-hidden="true">
              <label>site<input name="site" tabIndex={-1} autoComplete="off" /></label>
            </div>
            {notice && <p className={`${styles.message} ${notice.error ? styles.messageError : ""}`} role="alert">{notice.text}</p>}
            <button type="submit" className={styles.primary} disabled={sending}>{b.confirm}</button>
          </form>
        ) : (
          <>
            <h2 className={styles.pickerTitle}>{b.calendarTitle}</h2>
            <div className={styles.pickerColumns}>
              <div>
                <div className={styles.monthBar}>
                  <button type="button" className={styles.navButton} onClick={() => go(-1)} disabled={!canGoBack} aria-label={b.previousMonth}>
                    <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <span className={styles.monthName}>{monthLabel(month)}</span>
                  <button type="button" className={styles.navButton} onClick={() => go(1)} disabled={!canGoNext} aria-label={b.nextMonth}>
                    <ChevronRight size={22} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                {!state || state.status === "loading" ? (
                  <div className={styles.skeleton} aria-busy="true" aria-label={b.loading} />
                ) : state.status === "error" ? (
                  <p className={`${styles.message} ${styles.messageError}`} role="alert">{state.message}</p>
                ) : (
                  <>
                    <div className={styles.grid} role="grid" aria-label={monthLabel(month)}>
                      {WEEKDAYS.map((w) => <span key={w} className={styles.weekday}>{w}</span>)}
                      {Array.from({ length: firstWeekday }, (_, i) => <span key={`v${i}`} className={styles.dayEmpty} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                        const count = byDate[date]?.length ?? 0;
                        const label = `${formatDateLong(date)}, ${count === 0 ? b.noSlots : count === 1 ? b.slotsOne : b.slotsMany.replace("{n}", String(count))}`;
                        return (
                          <button
                            key={date}
                            type="button"
                            disabled={count === 0}
                            aria-label={label}
                            aria-pressed={selectedDate === date}
                            className={`${styles.day} ${count ? styles.dayAvailable : ""} ${selectedDate === date ? styles.daySelected : ""} ${date === todayGuest ? styles.today : ""}`}
                            onClick={() => { setSelectedDate(date); setSelectedSlot(null); setNotice(null); }}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    {Object.keys(byDate).length === 0 && (
                      <div className={styles.message}>
                        <p style={{ margin: 0 }}>{b.emptyMonth}</p>
                        {canGoNext && <button type="button" className={styles.linkButton} onClick={() => go(1)}>{b.nextMonth}</button>}
                      </div>
                    )}
                  </>
                )}
                <label className={styles.tz}>
                  <span className={styles.tzLabel}>{b.timeZone}</span>
                  <select className={styles.tzSelect} value={tz} onChange={(e) => { setTz(e.target.value); setSelectedDate(null); setSelectedSlot(null); }}>
                    {tzOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              {selectedDate && daySlots.length > 0 && (
                <div className={styles.slots}>
                  <p className={styles.slotsDay}>{formatDateLong(selectedDate)}</p>
                  <ul className={styles.slotList}>
                    {daySlots.map((iso) => (
                      <li key={iso}>
                        {selectedSlot === iso ? (
                          <div className={styles.slotSplit}>
                            <span className={styles.slotChosen}>{localTime(iso, tz)}</span>
                            <button type="button" className={styles.primary} onClick={() => setStep("form")}>{b.next}</button>
                          </div>
                        ) : (
                          <button type="button" className={styles.slot} onClick={() => setSelectedSlot(iso)}>{localTime(iso, tz)}</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {notice && <p className={`${styles.message} ${notice.error ? styles.messageError : ""}`} role="alert">{notice.text}</p>}
          </>
        )}
      </section>
    </div>
  );
}
