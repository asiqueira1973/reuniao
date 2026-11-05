// npm run resend:booking -- <id-da-reserva>
// Reenvia os e-mails que falharam de uma reserva confirmada, com link de gestão novo (regra 11.6;
// ver resendBookingEmails em src/server/booking.ts). Usa as variáveis do .env.local.
import { resendBookingEmails } from "../src/server/booking";

// Lê o id, roda o reenvio e mostra o resultado de cada e-mail (sem dados pessoais).
async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("uso: npm run resend:booking -- <id-da-reserva>");
  console.log(await resendBookingEmails(id));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
