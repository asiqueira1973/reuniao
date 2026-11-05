// Endereços públicos (slugs) da conta e dos tipos de evento — regra 11.11.
// Puro: roda no cliente (sugestão ao digitar) e no servidor (validação).

// Lista reservada para o slug da conta (regra 11.11); a mesma lista está no CHECK do banco.
export const RESERVED_ACCOUNT_SLUGS = [
  "painel", "entrar", "sair", "api", "r", "_next", "favicon.ico", "robots.txt", "sitemap.xml",
  "ajuda", "termos", "privacidade",
] as const;

// Formato aceito (o mesmo do CHECK ag_contas_slug_ck / ag_tipos_evento_slug_ck): 3–30
// caracteres, minúsculas, números e hífen, sem hífen nas pontas.
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

// Normaliza um texto livre em slug (regra 11.11): minúsculas, sem acento, espaços e pontos
// viram "-", remove o que não for [a-z0-9-], junta hífens repetidos e corta a 30 caracteres.
// Recebe: texto (nome do tipo, parte local do e-mail…). Devolve: slug (pode ser curto demais).
export function normalizeSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 30)
    .replace(/-+$/, "");
}

// Diz se o slug tem formato válido (regra 11.11). Não consulta o banco.
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

// Diz se o slug é reservado para rotas do app (só vale para o slug da conta).
export function isReservedAccountSlug(slug: string): boolean {
  return (RESERVED_ACCOUNT_SLUGS as readonly string[]).includes(slug);
}

// Gera candidatos de slug em ordem: base, base-2, base-3… (regra 11.9), respeitando os 30
// caracteres. Recebe: base já normalizada e quantos gerar. Devolve: lista de candidatos válidos.
export function slugCandidates(base: string, count = 20): string[] {
  const safeBase = isValidSlug(base) ? base : normalizeSlug(`${base}-agenda`).padEnd(3, "0");
  const out: string[] = [safeBase];
  for (let n = 2; out.length < count; n++) {
    const suffix = `-${n}`;
    out.push(`${safeBase.slice(0, 30 - suffix.length).replace(/-+$/, "")}${suffix}`);
  }
  return out;
}

// Limpa o que o dono digita no campo de endereço sem atrapalhar a digitação: igual a
// normalizeSlug, mas mantém um hífen no fim (ele pode estar no meio de "reuniao-").
export function sanitizeSlugInput(text: string): string {
  const keepDash = /[-\s.]$/.test(text);
  const base = normalizeSlug(text);
  return keepDash && base && base.length < 30 ? `${base}-` : base;
}
