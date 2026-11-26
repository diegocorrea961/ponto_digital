import type { PunchType } from "@/db/schema";
import { minuteOf } from "./time";

// Ordem em que as batidas acontecem no dia.
export const PUNCH_ORDER: PunchType[] = [
  "ENTRY",
  "LUNCH_OUT",
  "LUNCH_IN",
  "EXIT",
];

export const PUNCH_LABEL: Record<PunchType, string> = {
  ENTRY: "Entrada",
  LUNCH_OUT: "Saída para o almoço",
  LUNCH_IN: "Volta do almoço",
  EXIT: "Saída",
};

export const PUNCH_SHORT: Record<PunchType, string> = {
  ENTRY: "Entrada",
  LUNCH_OUT: "Saída almoço",
  LUNCH_IN: "Volta almoço",
  EXIT: "Saída",
};

// Texto do botão grande da funcionária.
export const PUNCH_ACTION: Record<PunchType, string> = {
  ENTRY: "Cheguei",
  LUNCH_OUT: "Saindo para o almoço",
  LUNCH_IN: "Voltei do almoço",
  EXIT: "Indo embora",
};

export function isPunchType(v: unknown): v is PunchType {
  return typeof v === "string" && (PUNCH_ORDER as string[]).includes(v);
}

/** Próxima batida esperada: o primeiro tipo da ordem que ainda não tem registro ativo. */
export function nextPunchType(active: { type: PunchType }[]): PunchType | null {
  const done = new Set(active.map((p) => p.type));
  return PUNCH_ORDER.find((t) => !done.has(t)) ?? null;
}

type AtByType = Partial<Record<PunchType, Date>>;

/**
 * Minutos trabalhados no dia.
 * - 4 batidas: (almoço - entrada) + (saída - volta)
 * - só entrada e saída (sem almoço registrado): saída - entrada
 * - incompleto: soma só os trechos fechados
 */
export function workedMinutes(at: AtByType): number {
  const m = (t: PunchType) => (at[t] ? minuteOf(at[t]!) : null);
  const entry = m("ENTRY");
  const lunchOut = m("LUNCH_OUT");
  const lunchIn = m("LUNCH_IN");
  const exit = m("EXIT");

  if (lunchOut === null && lunchIn === null) {
    return entry !== null && exit !== null ? Math.max(0, exit - entry) : 0;
  }
  let total = 0;
  if (entry !== null && lunchOut !== null) total += Math.max(0, lunchOut - entry);
  if (lunchIn !== null && exit !== null) total += Math.max(0, exit - lunchIn);
  return total;
}
