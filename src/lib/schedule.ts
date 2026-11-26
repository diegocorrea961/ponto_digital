// Jornada de trabalho e banco de horas. Só regras (sem banco de dados), para ficar fácil de testar.
import type { DayOffKind, DaySchedule, WeekSchedule } from "@/db/schema";
import { formatDuration, minuteOf, weekdayIndex, zonedToUtc } from "./time";

/**
 * Tolerância do dia: se a diferença entre trabalhado e previsto (para mais ou para menos)
 * for de até este valor, o saldo do dia é zero. Passou disso, conta a diferença INTEIRA.
 * O mesmo limite vale para os avisos de atraso e de horário da loja.
 */
export const TOLERANCE_MINUTES = 10;
export const MAX_LUNCH_MINUTES = 240;
/** Horário da loja sugerido nos dias sem horário fixo (pode ser mudado no cadastro). */
export const DEFAULT_OPEN = "09:00";
export const DEFAULT_CLOSE = "19:00";

// Segunda primeiro, como se fala de uma escala. `index` é o dia da semana (0 = domingo).
export const WEEKDAYS = [
  { index: 1, name: "Segunda" },
  { index: 2, name: "Terça" },
  { index: 3, name: "Quarta" },
  { index: 4, name: "Quinta" },
  { index: 5, name: "Sexta" },
  { index: 6, name: "Sábado" },
  { index: 0, name: "Domingo" },
] as const;

export const DAY_OFF_LABEL: Record<DayOffKind, string> = {
  HOLIDAY: "Feriado/folga",
  EXCUSED: "Atestado/abono",
};

// ---------- Preenchimento do formulário ----------

export type DayInput = {
  /** Tem horário fixo de entrada e saída? Se não, vale o total de horas. */
  fixedHours: boolean;
  /** Tem horário fixo de almoço? */
  fixedLunch: boolean;
  start: string;
  end: string;
  lunchStart: string;
  lunchEnd: string;
  /** Duração do almoço em minutos (só com entrada/saída fixas e almoço livre). */
  lunch: string;
  /** Total de horas do dia, "08:24" (só sem horário fixo). */
  duration: string;
  open: string;
  close: string;
};

/** "08:24" -> 504. Devolve null se não for um horário válido. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  return hours > 23 ? null : hours * 60 + Number(match[2]);
}

/** 504 -> "08:24" */
export function toClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return `${String(h).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Valida um dia da jornada. */
export function buildDay(input: DayInput): { day: DaySchedule } | { error: string } {
  let lunchFrom: number | null = null;
  let lunchTo: number | null = null;
  if (input.fixedLunch) {
    lunchFrom = parseClock(input.lunchStart);
    lunchTo = parseClock(input.lunchEnd);
    if (lunchFrom === null || lunchTo === null) {
      return { error: "informe o horário de saída e de volta do almoço." };
    }
    if (lunchTo <= lunchFrom) return { error: "a volta do almoço precisa ser depois da saída." };
    if (lunchTo - lunchFrom > MAX_LUNCH_MINUTES) {
      return { error: `o almoço pode ter no máximo ${MAX_LUNCH_MINUTES} minutos.` };
    }
  }
  const fixedLunch = {
    lunchStart: lunchFrom === null ? null : toClock(lunchFrom),
    lunchEnd: lunchTo === null ? null : toClock(lunchTo),
  };

  if (input.fixedHours) {
    const start = parseClock(input.start);
    const end = parseClock(input.end);
    if (start === null || end === null) return { error: "informe o horário de entrada e de saída." };
    if (end <= start) {
      return { error: "a saída precisa ser depois da entrada (turno que vira a noite não é suportado)." };
    }
    let lunch: number;
    if (lunchFrom !== null && lunchTo !== null) {
      if (lunchFrom <= start || lunchTo >= end) {
        return { error: "o almoço precisa ficar entre a entrada e a saída." };
      }
      lunch = lunchTo - lunchFrom;
    } else {
      lunch = /^\d+$/.test(input.lunch.trim()) ? Number(input.lunch) : NaN;
      if (!(lunch >= 0 && lunch <= MAX_LUNCH_MINUTES)) {
        return { error: `informe a duração do almoço em minutos, de 0 a ${MAX_LUNCH_MINUTES}.` };
      }
    }
    const minutes = end - start - lunch;
    if (minutes <= 0) return { error: "o almoço não pode ser maior ou igual ao expediente." };
    return {
      day: {
        minutes,
        start: toClock(start),
        end: toClock(end),
        ...fixedLunch,
        lunch,
        open: null,
        close: null,
      },
    };
  }

  // Sem horário fixo: o que vale é o total de horas.
  const minutes = parseClock(input.duration);
  if (!minutes) return { error: "informe o total de horas do dia, por exemplo 08:24." };
  const lunch = lunchFrom !== null && lunchTo !== null ? lunchTo - lunchFrom : null;

  let open: number | null = null;
  let close: number | null = null;
  if (input.open.trim() !== "" || input.close.trim() !== "") {
    open = parseClock(input.open);
    close = parseClock(input.close);
    if (open === null || close === null) {
      return { error: "informe os dois horários da loja (abre e fecha) ou deixe os dois em branco." };
    }
    if (close <= open) return { error: "o horário de fechar a loja precisa ser depois do de abrir." };
    if (minutes > close - open - (lunch ?? 0)) {
      return { error: "o total de horas não cabe dentro do horário da loja." };
    }
    if (lunchFrom !== null && lunchTo !== null && (lunchFrom < open || lunchTo > close)) {
      return { error: "o almoço precisa ficar dentro do horário da loja." };
    }
  }

  return {
    day: {
      minutes,
      start: null,
      end: null,
      ...fixedLunch,
      lunch,
      open: open === null ? null : toClock(open),
      close: close === null ? null : toClock(close),
    },
  };
}

/** Lê os campos d0_..d6_ do formulário de jornada. */
export function parseScheduleForm(
  formData: FormData,
): { week: WeekSchedule } | { error: string } {
  const week: WeekSchedule = {};
  const text = (name: string) => String(formData.get(name) ?? "");

  for (const { index, name } of WEEKDAYS) {
    if (formData.get(`d${index}_on`) !== "on") continue;
    const result = buildDay({
      fixedHours: formData.get(`d${index}_fixed`) === "on",
      fixedLunch: formData.get(`d${index}_fixedLunch`) === "on",
      start: text(`d${index}_start`),
      end: text(`d${index}_end`),
      lunchStart: text(`d${index}_lunchStart`),
      lunchEnd: text(`d${index}_lunchEnd`),
      lunch: text(`d${index}_lunch`),
      duration: text(`d${index}_duration`),
      open: text(`d${index}_open`),
      close: text(`d${index}_close`),
    });
    if ("error" in result) return { error: `${name}: ${result.error}` };
    week[String(index)] = result.day;
  }

  if (Object.keys(week).length === 0) return { error: "Marque pelo menos um dia de trabalho." };
  return { week };
}

/** Uma linha por dia trabalhado, para mostrar na tela. */
export function describeWeek(week: WeekSchedule): { name: string; text: string }[] {
  return WEEKDAYS.flatMap(({ index, name }) => {
    const day = week[String(index)];
    if (!day) return [];
    const hours = day.start
      ? `${day.start} às ${day.end}`
      : day.open
        ? `horário livre entre ${day.open} e ${day.close}`
        : "horário livre";
    const lunch = day.lunchStart
      ? `almoço das ${day.lunchStart} às ${day.lunchEnd}`
      : day.lunch !== null
        ? `${day.lunch} min de almoço em horário livre`
        : "almoço em horário livre";
    return [{ name, text: `${hours}, ${lunch} (${formatDuration(day.minutes)} no dia)` }];
  });
}

// ---------- Qual jornada vale em cada dia ----------

export type ScheduleVersion = {
  id: string;
  validFrom: string;
  createdAt: Date;
  days: WeekSchedule;
};

/** A versão que vale na data: a de início mais recente (até a data); no empate, a criada por último. */
export function versionFor<T extends ScheduleVersion>(versions: T[], date: string): T | undefined {
  let best: T | undefined;
  for (const v of versions) {
    if (v.validFrom > date) continue;
    if (
      !best ||
      v.validFrom > best.validFrom ||
      (v.validFrom === best.validFrom && v.createdAt > best.createdAt)
    ) {
      best = v;
    }
  }
  return best;
}

export function dayScheduleFor(
  versions: ScheduleVersion[],
  date: string,
): DaySchedule | undefined {
  return versionFor(versions, date)?.days[String(weekdayIndex(date))];
}

// ---------- Banco de horas ----------

export function applyTolerance(diffMinutes: number): number {
  return Math.abs(diffMinutes) <= TOLERANCE_MINUTES ? 0 : diffMinutes;
}

export type DayEvaluation = {
  /** Minutos previstos; null quando o dia não entra no banco (antes da jornada ou após desativação). */
  expected: number | null;
  /** Saldo do dia; null quando ainda não dá para calcular. */
  balance: number | null;
  /** Dia passado com batida faltando: fica fora do saldo até ser ajustado. */
  pending: boolean;
  /** Dia de trabalho passado sem nenhuma batida e sem abono. */
  absent: boolean;
  /** Minutos de atraso na chegada (só com entrada fixa; 0 se dentro da tolerância). */
  lateEntry: number;
  /** Minutos de atraso na volta do almoço (só com almoço fixo; 0 se dentro da tolerância). */
  lateLunch: number;
  /** Chegou antes de a loja abrir ou saiu depois de fechar (dia sem horário fixo). */
  outsideStoreHours: boolean;
};

export function evaluateDay(args: {
  date: string;
  today: string;
  tracked: boolean;
  scheduled: DaySchedule | undefined;
  dayOff: DayOffKind | undefined;
  worked: number;
  hasPunches: boolean;
  complete: boolean;
  entryAt: Date | undefined;
  lunchInAt: Date | undefined;
  exitAt: Date | undefined;
}): DayEvaluation {
  const { date, today, tracked, scheduled, dayOff, worked, hasPunches, complete } = args;
  const result: DayEvaluation = {
    expected: null,
    balance: null,
    pending: false,
    absent: false,
    lateEntry: 0,
    lateLunch: 0,
    outsideStoreHours: false,
  };
  if (!tracked) return result;

  const scheduledMinutes = scheduled?.minutes ?? 0;
  result.expected = dayOff ? 0 : scheduledMinutes;

  if (!dayOff && scheduled) {
    /** Minutos que `at` passou do horário "HH:MM" (negativo = antes). */
    const after = (at: Date, clock: string) => minuteOf(at) - minuteOf(zonedToUtc(date, clock));
    const late = (at: Date | undefined, clock: string | null) => {
      const minutes = at && clock ? after(at, clock) : 0;
      return minutes > TOLERANCE_MINUTES ? minutes : 0;
    };
    result.lateEntry = late(args.entryAt, scheduled.start);
    result.lateLunch = late(args.lunchInAt, scheduled.lunchEnd);
    result.outsideStoreHours = Boolean(
      (scheduled.open && args.entryAt && after(args.entryAt, scheduled.open) < -TOLERANCE_MINUTES) ||
        late(args.exitAt, scheduled.close),
    );
  }

  // O futuro não aconteceu, e hoje só entra no saldo depois das 4 batidas (até a saída o dia
  // está em andamento: não é falta nem incompleto).
  if (date > today || (date === today && !complete)) return result;

  if (dayOff === "EXCUSED") {
    // Nunca gera débito. Só vira extra o que passar da jornada normal do dia.
    const diff = complete ? applyTolerance(worked - scheduledMinutes) : 0;
    result.balance = Math.max(0, diff);
    return result;
  }

  if (hasPunches && !complete) {
    result.pending = true;
    return result;
  }

  result.balance = applyTolerance(worked - result.expected);
  result.absent = !hasPunches && result.expected > 0;
  return result;
}
