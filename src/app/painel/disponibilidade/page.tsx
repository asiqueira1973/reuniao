// [Dono] Disponibilidade — seção 10 e épico 8.3: horários semanais, datas específicas e feriados.
// Lê tudo no servidor (filtrado por conta_id) e entrega aos três blocos, cada um com Salvar próprio.
// "Hoje" é calculado no fuso da conta (regra 11.1). Dados dentro de <Suspense> (Cache Components).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DateOverrides } from "@/features/availability/components/date-overrides";
import { HolidaysEditor } from "@/features/availability/components/holidays-editor";
import { WeeklyEditor } from "@/features/availability/components/weekly-editor";
import blockStyles from "@/features/availability/components/availability.module.css";
import { copy } from "@/lib/copy";
import { getCurrentAccount } from "@/server/auth/require-conta";
import { getHolidayState, getWeeklyRanges, listDateOverrides, todayIn } from "@/server/db/availability";
import styles from "../painel.module.css";

// Carrega faixas, datas futuras e feriados da conta da sessão.
async function AvailabilityContent() {
  const account = await getCurrentAccount();
  if (!account) redirect("/entrar");
  const holidays = await getHolidayState(account.id);
  const today = todayIn(holidays.fuso);
  const [weekly, overrides] = await Promise.all([getWeeklyRanges(account.id), listDateOverrides(account.id, today)]);
  return (
    <div className={blockStyles.blocks}>
      <WeeklyEditor initial={weekly} />
      <DateOverrides initial={overrides} today={today} />
      <HolidaysEditor initial={{ feriados_ativos: holidays.feriados_ativos, feriados_desligados: holidays.feriados_desligados }} today={today} />
    </div>
  );
}

// Página: título e os três blocos (carregam em streaming).
export default function AvailabilityPage() {
  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{copy.availability.title}</h1>
      </div>
      <Suspense fallback={<div className={blockStyles.block} aria-busy="true" />}>
        <AvailabilityContent />
      </Suspense>
    </>
  );
}
