// Modelos de e-mail — regra 11.6 e seção 16 ("HTML simples, fundo branco, título grande, botão azul
// arredondado, rodapé discreto; versão texto puro junto"). Assuntos da seção 15. Datas do convidado
// no fuso dele (fuso_convidado) e as do dono no fuso da conta (regra 11.1).
import "server-only";
import { copy } from "@/lib/copy";
import { formatDateTimeLong, formatSubjectGuest, formatSubjectOwner, timeZoneName } from "@/lib/format";

const e = copy.emails;

export type RenderedEmail = { subject: string; html: string; text: string };

// Substitui {chave} pelos valores.
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
}

// Escapa texto para HTML (nomes e observações vêm do convidado).
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Botão azul arredondado (seção 16).
function button(label: string, href: string, secondary = false): string {
  const style = secondary
    ? "background:#ffffff;color:#0071e3;border:1px solid #d2d2d7"
    : "background:#0071e3;color:#ffffff;border:1px solid #0071e3";
  return `<a href="${esc(href)}" style="display:inline-block;${style};padding:12px 22px;border-radius:999px;font-weight:600;text-decoration:none;margin:0 8px 8px 0">${esc(label)}</a>`;
}

// Casca do e-mail: título grande, linhas de detalhe, botões e rodapé com o nome do app.
function layout(title: string, rows: [string, string][], buttons: string, footer: string): string {
  const details = rows
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#6e6e73;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#1d1d1f">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<h1 style="font-size:26px;line-height:1.2;margin:0 0 20px;letter-spacing:-0.02em">${esc(title)}</h1>
<table style="border-collapse:collapse;font-size:15px;margin-bottom:24px">${details}</table>
<div>${buttons}</div>
<p style="margin:28px 0 0;font-size:13px;color:#6e6e73">${esc(footer)}</p>
</div></body></html>`;
}

type BookingData = {
  ownerName: string;
  typeName: string;
  guestName: string;
  guestEmail: string;
  notes: string | null;
  start: string;
  guestTimeZone: string;
  ownerTimeZone: string;
  meetLink: string | null;
  manageUrl: string;
};

// Confirmação para o convidado: tipo, data/hora no fuso dele (com o nome do fuso), Meet e links
// de remarcar/cancelar (/r/{token}) — regra 11.6.
export function confirmationToGuest(d: BookingData): RenderedEmail {
  const when = `${formatDateTimeLong(d.start, d.guestTimeZone)} (${timeZoneName(d.guestTimeZone)})`;
  const subject = fill(e.subjects.confirmacao_convidado, { tipo: d.typeName, dono: d.ownerName, quando: formatSubjectGuest(d.start, d.guestTimeZone) });
  const title = fill(e.confirmationIntro, { dono: d.ownerName });
  const rows: [string, string][] = [[e.type, d.typeName], [e.when, when]];
  if (d.meetLink) rows.push([copy.booking.meet, d.meetLink]);
  const buttons = (d.meetLink ? button(copy.booking.joinMeet, d.meetLink) : "") + button(e.reschedule, d.manageUrl, true) + button(e.cancel, d.manageUrl, true);
  const text = [title, "", `${e.type}: ${d.typeName}`, `${e.when}: ${when}`, d.meetLink ? `${copy.booking.meet}: ${d.meetLink}` : "", "", `${e.reschedule} / ${e.cancel}: ${d.manageUrl}`]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  return { subject, html: layout(title, rows, buttons, e.manageHint), text };
}

// Aviso para o dono de reserva nova: convidado, e-mail, tipo, data/hora no fuso da conta, observação.
export function newBookingToOwner(d: BookingData): RenderedEmail {
  const when = formatDateTimeLong(d.start, d.ownerTimeZone);
  const subject = fill(e.subjects.aviso_dono_nova, { convidado: d.guestName, quando: formatSubjectOwner(d.start, d.ownerTimeZone) });
  const title = fill(e.ownerIntro, { convidado: d.guestName });
  const rows: [string, string][] = [[e.guest, `${d.guestName} (${d.guestEmail})`], [e.type, d.typeName], [e.when, when]];
  if (d.notes) rows.push([e.guestNotes, d.notes]);
  if (d.meetLink) rows.push([copy.booking.meet, d.meetLink]);
  const text = [title, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  return { subject, html: layout(title, rows, d.meetLink ? button(copy.booking.joinMeet, d.meetLink) : "", copy.appName), text };
}

// Aviso de conexão revogada (seção 6): link para reconectar no painel.
export function reconnectToOwner(siteUrl: string): RenderedEmail {
  const url = `${siteUrl.replace(/\/+$/, "")}/painel/conta`;
  return {
    subject: e.subjects.reconectar_google,
    html: layout(e.subjects.reconectar_google, [], button(e.reconnectButton, url), e.reconnectBody),
    text: `${e.reconnectBody}\n\n${e.reconnectButton}: ${url}`,
  };
}

type ChangeData = {
  ownerName: string;
  typeName: string;
  guestName: string;
  guestEmail: string;
  ownerTimeZone: string;
  start: string;
  reason: string | null;
};

// Aviso ao dono de cancelamento pelo convidado (regra 11.6): convidado, horário (fuso da conta), motivo.
export function cancelledToOwner(d: ChangeData): RenderedEmail {
  const subject = fill(e.subjects.aviso_dono_cancelada, { convidado: d.guestName, quando: formatSubjectOwner(d.start, d.ownerTimeZone) });
  const title = fill(e.cancelledByGuestIntro, { convidado: d.guestName });
  const rows: [string, string][] = [[e.guest, `${d.guestName} (${d.guestEmail})`], [e.type, d.typeName], [e.when, formatDateTimeLong(d.start, d.ownerTimeZone)]];
  if (d.reason) rows.push([e.reason, d.reason]);
  return { subject, html: layout(title, rows, "", copy.appName), text: [title, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n") };
}

// Aviso ao dono de remarcação (regra 11.6): horário antigo → novo, no fuso da conta.
export function rescheduledToOwner(d: ChangeData & { previousStart: string; meetLink: string | null }): RenderedEmail {
  const subject = fill(e.subjects.aviso_dono_remarcada, {
    convidado: d.guestName,
    antes: formatSubjectOwner(d.previousStart, d.ownerTimeZone),
    depois: formatSubjectOwner(d.start, d.ownerTimeZone),
  });
  const title = fill(e.rescheduledIntro, { convidado: d.guestName });
  const rows: [string, string][] = [
    [e.guest, `${d.guestName} (${d.guestEmail})`],
    [e.type, d.typeName],
    [e.before, formatDateTimeLong(d.previousStart, d.ownerTimeZone)],
    [e.after, formatDateTimeLong(d.start, d.ownerTimeZone)],
  ];
  if (d.meetLink) rows.push([copy.booking.meet, d.meetLink]);
  return { subject, html: layout(title, rows, d.meetLink ? button(copy.booking.joinMeet, d.meetLink) : "", copy.appName), text: [title, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n") };
}
