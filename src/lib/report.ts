import { and, asc, between, eq } from "drizzle-orm";
import { db } from "@/db";
import { punches, users, type Punch, type PunchType } from "@/db/schema";
import { PUNCH_ORDER, workedMinutes } from "./punches";
import { parseMonth, weekdayIndex, workDateOf } from "./time";

export type DayRow = {
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
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const month = parseMonth(monthInput);
  const list = await db
    .select()
    .from(punches)
    .where(
      and(
        eq(punches.userId, userId),
        between(punches.workDate, month.first, month.last),
      ),
    )
    .orderBy(asc(punches.at));

  const today = workDateOf(new Date());
  const byDate = new Map<string, Punch[]>();
  for (const p of list) {
    const arr = byDate.get(p.workDate) ?? [];
    arr.push(p);
    byDate.set(p.workDate, arr);
  }

  const rows: DayRow[] = month.days.map((date) => {
    const all = byDate.get(date) ?? [];
    const active = all.filter((p) => !p.voidedAt);
    const byType: DayRow["byType"] = {};
    for (const p of active) byType[p.type] = p;
    const at = Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, v!.at]),
    );
    return {
      date,
      weekday: weekdayIndex(date),
      isFuture: date > today,
      byType,
      all,
      minutes: workedMinutes(at),
      complete: PUNCH_ORDER.every((t) => byType[t]),
      hasPunches: active.length > 0,
      hasManual: active.some((p) => p.source === "MANUAL"),
    };
  });

  const worked = rows.filter((r) => r.hasPunches);
  return {
    user,
    month,
    rows,
    totals: {
      daysWorked: worked.length,
      minutes: worked.reduce((s, r) => s + r.minutes, 0),
      // O dia de hoje ainda pode estar em andamento, então não conta como incompleto.
      incompleteDays: worked.filter((r) => !r.complete && r.date !== today).length,
      manualPunches: rows.reduce(
        (s, r) =>
          s + r.all.filter((p) => !p.voidedAt && p.source === "MANUAL").length,
        0,
      ),
    },
  };
}
