import { and, asc, between, eq, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { dayOffs, punches, users, type DayOff, type Punch, type PunchType } from "@/db/schema";
import { PUNCH_ORDER, workedMinutes } from "./punches";
import { dayScheduleFor, evaluateDay, type DayEvaluation } from "./schedule";
import { getScheduleVersions } from "./schedule-data";
import { addDays, parseMonth, weekdayIndex, workDateOf } from "./time";

export type DayRow = DayEvaluation & {
  date: string;
  weekday: number; // 0 = domingo
  isFuture: boolean;
  /** Batidas ativas, por tipo. */
  byType: Partial<Record<PunchType, Punch>>;
  /** Todas as batidas do dia, inclusive as anuladas (para a tela de ajuste). */
  all: Punch[];
  minutes: number;
  complete: boolean;
  hasPunches: boolean;
  hasManual: boolean;
  /** O dia faz parte da jornada contratada. */
  isWorkDay: boolean;
  /** Feriado, folga, atestado ou abono que cobre este dia. */
  dayOff: DayOff | null;
};

export type BankSummary = {
  /** Data em que a primeira jornada começa a valer. */
  since: string;
  /** Saldo acumulado antes do mês exibido. */
  previous: number;
  /** Saldo do mês exibido. */
  month: number;
  /** previous + month */
  accumulated: number;
  /** Horas previstas dos dias do mês que entraram no saldo. */
  expectedMinutes: number;
  absences: number;
  lateDays: number;
  /** Dias com batida faltando, fora do saldo. */
  pendingMonth: number;
  pendingPrevious: number;
};

export type MonthReport = {
  user: { id: string; name: string; username: string; active: boolean };
  month: ReturnType<typeof parseMonth>;
  rows: DayRow[];
  totals: {
    daysWorked: number;
    minutes: number;
    incompleteDays: number;
    manualPunches: number;
  };
  /** null quando não há jornada cadastrada valendo até este mês. */
  bank: BankSummary | null;
};

export async function getMonthReport(
  userId: string,
  monthInput?: string | null,
): Promise<MonthReport | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      active: users.active,
      deactivatedOn: users.deactivatedOn,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const month = parseMonth(monthInput);
  const versions = await getScheduleVersions(userId);
  const since = versions[0]?.validFrom ?? null; // vêm ordenadas pela data de início
  // O saldo acumulado precisa das batidas desde o início da jornada.
  const from = since && since < month.first ? since : month.first;

  const [list, offs] = await Promise.all([
    db
      .select()
      .from(punches)
      .where(and(eq(punches.userId, userId), between(punches.workDate, from, month.last)))
      .orderBy(asc(punches.at)),
    db
      .select()
      .from(dayOffs)
      .where(and(eq(dayOffs.userId, userId), isNull(dayOffs.removedAt))),
  ]);

  // Funcionário inativo não acumula faltas: o banco para na desativação. Quem foi
  // desativado antes dessa data existir para no último dia com batida.
  let lastTracked: string | null = null;
  if (!user.active) {
    if (user.deactivatedOn) {
      lastTracked = addDays(user.deactivatedOn, -1);
    } else {
      const [last] = await db
        .select({ date: max(punches.workDate) })
        .from(punches)
        .where(and(eq(punches.userId, userId), isNull(punches.voidedAt)));
      lastTracked = last?.date ?? "0000-00-00";
    }
  }

  const today = workDateOf(new Date());
  const byDate = new Map<string, Punch[]>();
  for (const p of list) {
    const arr = byDate.get(p.workDate) ?? [];
    arr.push(p);
    byDate.set(p.workDate, arr);
  }

  function buildRow(date: string): DayRow {
    const all = byDate.get(date) ?? [];
    const active = all.filter((p) => !p.voidedAt);
    const byType: DayRow["byType"] = {};
    for (const p of active) byType[p.type] = p;
    const at = Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, v!.at]),
    );

    const scheduled = dayScheduleFor(versions, date);
    const dayOff = offs.find((o) => o.startDate <= date && date <= o.endDate) ?? null;
    const minutes = workedMinutes(at);
    const hasPunches = active.length > 0;
    const complete = PUNCH_ORDER.every((t) => byType[t]);
    const tracked =
      since !== null && date >= since && (lastTracked === null || date <= lastTracked);

    return {
      date,
      weekday: weekdayIndex(date),
      isFuture: date > today,
      byType,
      all,
      minutes,
      complete,
      hasPunches,
      hasManual: active.some((p) => p.source === "MANUAL"),
      isWorkDay: scheduled !== undefined,
      dayOff,
      ...evaluateDay({
        date,
        today,
        tracked,
        scheduled,
        dayOff: dayOff?.kind,
        worked: minutes,
        hasPunches,
        complete,
        entryAt: byType.ENTRY?.at,
        lunchInAt: byType.LUNCH_IN?.at,
        exitAt: byType.EXIT?.at,
      }),
    };
  }

  const rows = month.days.map(buildRow);

  let bank: BankSummary | null = null;
  if (since !== null && since <= month.last) {
    let previous = 0;
    let pendingPrevious = 0;
    for (let date = since; date < month.first && date <= today; date = addDays(date, 1)) {
      const row = buildRow(date);
      previous += row.balance ?? 0;
      if (row.pending) pendingPrevious++;
    }
    const counted = rows.filter((r) => r.balance !== null);
    const monthBalance = counted.reduce((s, r) => s + r.balance!, 0);
    bank = {
      since,
      previous,
      month: monthBalance,
      accumulated: previous + monthBalance,
      expectedMinutes: counted.reduce((s, r) => s + (r.expected ?? 0), 0),
      absences: rows.filter((r) => r.absent).length,
      lateDays: rows.filter((r) => r.lateEntry > 0 || r.lateLunch > 0).length,
      pendingMonth: rows.filter((r) => r.pending).length,
      pendingPrevious,
    };
  }

  const worked = rows.filter((r) => r.hasPunches);
  return {
    user,
    month,
    rows,
    totals: {
      daysWorked: worked.length,
      minutes: worked.reduce((s, r) => s + r.minutes, 0),
      // O dia de hoje ainda pode estar em andamento, então não conta como incompleto.
      incompleteDays: worked.filter(
        (r) => !r.complete && r.date !== today && r.dayOff?.kind !== "EXCUSED",
      ).length,
      manualPunches: rows.reduce(
        (s, r) =>
          s + r.all.filter((p) => !p.voidedAt && p.source === "MANUAL").length,
        0,
      ),
    },
    bank,
  };
}
