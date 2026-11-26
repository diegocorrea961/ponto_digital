// Validações de formulário usadas por mais de uma ação.
import { z } from "zod";
import { addDays, isRealDate, workDateOf } from "./time";

export const dateSchema = z.string().refine(isRealDate, "Data inválida.");

/** Início da jornada: limites folgados, só para barrar erro de digitação no ano. */
export const validFromSchema = dateSchema.refine(
  (d) => d >= "2020-01-01" && d <= addDays(workDateOf(new Date()), 366),
  "Confira a data de início da jornada (entre 2020 e um ano à frente).",
);
