// Validação da tela Conta — seção 13 (PATCH/DELETE /api/painel/conta) e regras 11.1 e 11.11. Puro.
import { z } from "zod";
import { isReservedAccountSlug, SLUG_PATTERN } from "@/lib/slug";

// Fuso IANA válido (regra 11.1): só nomes da lista do Intl (ex.: America/Sao_Paulo), com a
// grafia exata; recusa deslocamentos ("+03:00") e variações de caixa que o Intl também aceitaria.
export function isTimeZone(tz: string): boolean {
  if (typeof Intl.supportedValuesOf === "function" && Intl.supportedValuesOf("timeZone").includes(tz)) return true;
  try {
    // Nomes válidos fora da lista (ex.: UTC) só se o Intl devolver a mesma grafia.
    return new Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone === tz && /^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/.test(tz);
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

// Boas-vindas (spec v0.5, 8.11): nome, endereço e fuso obrigatórios e o aceite marcado (true).
export const welcomeSchema = z
  .object({
    nome_exibicao: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .regex(SLUG_PATTERN)
      .refine((s) => !isReservedAccountSlug(s), { message: RESERVED_SLUG }),
    fuso: z.string().max(64).refine(isTimeZone),
    aceite: z.literal(true),
  })
  .strict();
