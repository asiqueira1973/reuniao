// Validação das rotas de disponibilidade — seção 13 e épico 8.3. Puro.
import { z } from "zod";
import { findOverlap, isValidRange, isValidTime } from "./ranges";
import { isHolidayCode } from "./holidays";

const time = z.string().refine(isValidTime);
const range = z.object({ inicio: time, fim: time }).strict().refine(isValidRange);
const date = z.iso.date();

// Marca de erro "faixa_sobreposta" para a rota responder o código certo (seção 15).
export const OVERLAP_MESSAGE = "faixa_sobreposta";

// PUT /semanal: todas as faixas da semana de uma vez; sobreposição no mesmo dia é recusada.
export const weeklySchema = z
  .object({
    faixas: z
      .array(range.and(z.object({ dia_semana: z.number().int().min(0).max(6) })))
      .max(70),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (let d = 0; d <= 6; d++) {
      if (findOverlap(v.faixas.filter((f) => f.dia_semana === d))) ctx.addIssue({ code: "custom", message: OVERLAP_MESSAGE });
    }
  });

// PUT /datas: uma data, indisponível (sem faixas) ou com faixas próprias (ao menos uma).
export const dateOverrideSchema = z
  .discriminatedUnion("tipo", [
    z.object({ data: date, tipo: z.literal("indisponivel") }).strict(),
    z.object({ data: date, tipo: z.literal("horario_especial"), faixas: z.array(range).min(1).max(10) }).strict(),
  ])
  .superRefine((v, ctx) => {
    if (v.tipo === "horario_especial" && findOverlap(v.faixas)) ctx.addIssue({ code: "custom", message: OVERLAP_MESSAGE });
  });

// DELETE /datas: só a data.
export const dateDeleteSchema = z.object({ data: date }).strict();

// PUT /feriados: chave geral e lista de códigos desligados (regra 11.4).
export const holidaysSchema = z
  .object({
    feriados_ativos: z.boolean(),
    feriados_desligados: z.array(z.string().refine(isHolidayCode)).max(14),
  })
  .strict();

export type WeeklyInput = z.infer<typeof weeklySchema>;
export type DateOverrideInput = z.infer<typeof dateOverrideSchema>;
export type HolidaysInput = z.infer<typeof holidaysSchema>;
