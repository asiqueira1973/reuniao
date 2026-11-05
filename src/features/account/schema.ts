// Validação da tela Conta — seção 13 (PATCH/DELETE /api/painel/conta) e regras 11.1 e 11.11. Puro.
import { z } from "zod";
import { isReservedAccountSlug, SLUG_PATTERN } from "@/lib/slug";

// Fuso IANA válido para o Intl (regra 11.1).
export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Código de erro do slug reservado (o resto do formato é dados_invalidos).
export const RESERVED_SLUG = "slug_reservado";

// PATCH: qualquer subconjunto, sem padrões. Mensagem vazia vira null (= sem mensagem, 7.3).
export const accountPatchSchema = z
  .object({
    nome_exibicao: z.string().trim().min(1).max(100).optional(),
    slug: z
      .string()
      .regex(SLUG_PATTERN)
      .refine((s) => !isReservedAccountSlug(s), { message: RESERVED_SLUG })
      .optional(),
    mensagem_boas_vindas: z
      .string()
      .trim()
      .max(300)
      .nullable()
      .transform((v) => (v ? v : null))
      .optional(),
    fuso: z.string().max(64).refine(isTimeZone).optional(),
  })
  .strict();

// DELETE: a pessoa digita o endereço da conta para confirmar (critério 8.8).
export const accountDeleteSchema = z.object({ confirmacao: z.string().max(40) }).strict();

export type AccountPatch = z.infer<typeof accountPatchSchema>;
