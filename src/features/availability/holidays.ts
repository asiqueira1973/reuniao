// Feriados nacionais do Brasil — regra 11.4.
// Nesta versão (épico 8.1) só a tabela de códigos e o padrão de conta nova; o cálculo das datas
// (Páscoa e derivados) entra no épico 8.4, com testes.

export type HolidayCode =
  | "confraternizacao" | "carnaval_segunda" | "carnaval_terca" | "cinzas" | "sexta_santa"
  | "tiradentes" | "trabalho" | "corpus_christi" | "independencia" | "aparecida" | "finados"
  | "republica" | "consciencia_negra" | "natal";

// Tabela 11.4: código, nome exibido e se nasce ligado na conta nova.
export const HOLIDAYS: ReadonlyArray<{ code: HolidayCode; name: string; onByDefault: boolean }> = [
  { code: "confraternizacao", name: "Confraternização Universal", onByDefault: true },
  { code: "carnaval_segunda", name: "Carnaval (segunda)", onByDefault: false },
  { code: "carnaval_terca", name: "Carnaval (terça)", onByDefault: false },
  { code: "cinzas", name: "Quarta-feira de Cinzas", onByDefault: false },
  { code: "sexta_santa", name: "Sexta-feira Santa", onByDefault: true },
  { code: "tiradentes", name: "Tiradentes", onByDefault: true },
  { code: "trabalho", name: "Dia do Trabalho", onByDefault: true },
  { code: "corpus_christi", name: "Corpus Christi", onByDefault: false },
  { code: "independencia", name: "Independência", onByDefault: true },
  { code: "aparecida", name: "Nossa Senhora Aparecida", onByDefault: true },
  { code: "finados", name: "Finados", onByDefault: true },
  { code: "republica", name: "Proclamação da República", onByDefault: true },
  { code: "consciencia_negra", name: "Consciência Negra", onByDefault: true },
  { code: "natal", name: "Natal", onByDefault: true },
];

// Códigos que a conta nova já grava em feriados_desligados (regra 11.4: "ligado por padrão = não").
export const DEFAULT_DISABLED_HOLIDAYS: HolidayCode[] = HOLIDAYS.filter((h) => !h.onByDefault).map((h) => h.code);
