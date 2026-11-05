// Envio de e-mail pelo Resend — regra 11.6. Usa a API HTTP (fetch) com Idempotency-Key, para que
// um reenvio da mesma notificação nunca gere e-mail duplicado. Remetente "{nome} <EMAIL_REMETENTE>".
// Nunca registra destinatário nem conteúdo em log (seção 20).
import "server-only";

export const RESEND_URL = "https://api.resend.com/emails";

export type OutgoingEmail = {
  fromName: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

// Envia e devolve o id do Resend. Lança erro com mensagem curta e sem dados pessoais.
export async function sendEmail(email: OutgoingEmail): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_REMETENTE;
  if (!key || !from) throw new Error("resend_nao_configurado");
  // Aspas e sinais de < > no nome quebrariam o cabeçalho From.
  const safeName = email.fromName.replace(/["<>]/g, "").trim();
  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": email.idempotencyKey },
      body: JSON.stringify({
        from: `${safeName} <${from}>`,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("resend_sem_resposta");
  }
  if (!res.ok) throw new Error(`resend_${res.status}`);
  const body = (await res.json()) as { id?: string };
  return body.id ?? "";
}
