// Horários livres de um tipo de evento — épico 8.4 (orquestra a regra 11.2).
// Busca conta, tipo, faixas, datas, feriados, reservas ativas e o livre/ocupado do Google e chama
// o motor puro computeSlots. Princípio 2: conexão revogada ou Google falhando → erro, nunca uma
// lista de horários "sem conferir".
import "server-only";
import { TZDate } from "@date-fns/tz";
import { computeSlots, type DaySlots } from "@/features/availability/compute";
import { addDays } from "@/features/availability/holidays";
import { getWeeklyRanges, listDateOverrides, todayIn } from "@/server/db/availability";
import { getPublicAccount, getPublicEventType, listBlockingReservations, type PublicAccount, type PublicEventType } from "@/server/db/public";
import { queryFreeBusy } from "@/server/google/calendar";

// Erro de consulta com o código da seção 13.
export class AvailabilityLookupError extends Error {
  constructor(public readonly code: "nao_encontrado" | "tipo_indisponivel" | "agenda_indisponivel") {
    super(code);
  }
}

export type AvailabilityResult = { fuso_conta: string; dias: DaySlots[]; conta: PublicAccount; tipo: PublicEventType };

// Instante ISO da meia-noite de uma data civil no fuso da conta.
function midnight(date: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new TZDate(y, m - 1, d, 0, 0, timeZone);
}

// Calcula os horários livres entre as datas pedidas (no fuso da conta). Lança
// AvailabilityLookupError (conta/tipo inexistente, tipo inativo, conexão revogada) ou
// CalendarError (Google fora do ar ou lento).
export async function getAvailability(params: {
  accountSlug: string;
  typeSlug: string;
  from?: string;
  to?: string;
  now?: Date;
}): Promise<AvailabilityResult> {
  const now = params.now ?? new Date();
  const conta = await getPublicAccount(params.accountSlug);
  if (!conta) throw new AvailabilityLookupError("nao_encontrado");
  const tipo = await getPublicEventType(conta.id, params.typeSlug);
  if (!tipo) throw new AvailabilityLookupError("nao_encontrado");
  if (!tipo.ativo) throw new AvailabilityLookupError("tipo_indisponivel");
  if (!conta.conexao_ativa) throw new AvailabilityLookupError("agenda_indisponivel");

  // Recorta o pedido pela janela do tipo (regra 11.2, passo 1) antes de consultar o Google.
  const today = todayIn(conta.fuso, now);
  const lastDay = addDays(today, tipo.janela_dias - 1);
  const from = params.from && params.from > today ? params.from : today;
  const to = params.to && params.to < lastDay ? params.to : lastDay;
  if (from > to) return { fuso_conta: conta.fuso, dias: [], conta, tipo };

  // Ocupados cobrindo o dia inteiro mais as folgas do tipo.
  const timeMin = new Date(midnight(from, conta.fuso).getTime() - tipo.intervalo_antes_min * 60_000).toISOString();
  const timeMax = new Date(midnight(addDays(to, 1), conta.fuso).getTime() + (tipo.duracao_min + tipo.intervalo_depois_min) * 60_000).toISOString();

  const [weekly, overrides, reservations, googleBusy] = await Promise.all([
    getWeeklyRanges(conta.id),
    listDateOverrides(conta.id, from),
    listBlockingReservations(conta.id, timeMin, timeMax),
    queryFreeBusy(conta.id, timeMin, timeMax),
  ]);

  const dias = computeSlots({
    eventType: tipo,
    timeZone: conta.fuso,
    weekly,
    overrides,
    holidays: { feriados_ativos: conta.feriados_ativos, feriados_desligados: conta.feriados_desligados },
    busy: [...googleBusy, ...reservations],
    now,
    from,
    to,
  });
  return { fuso_conta: conta.fuso, dias, conta, tipo };
}
