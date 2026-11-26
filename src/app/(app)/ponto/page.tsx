import { and, asc, eq, isNull } from "drizzle-orm";
import { Clock } from "@/components/clock";
import { cardClass } from "@/components/ui";
import { db } from "@/db";
import { punches } from "@/db/schema";
import { requireEmployee } from "@/lib/auth";
import {
  nextPunchType,
  PUNCH_ACTION,
  PUNCH_LABEL,
  PUNCH_ORDER,
  PUNCH_SHORT,
} from "@/lib/punches";
import { formatTime, longDateLabel, workDateOf } from "@/lib/time";
import { PunchForm } from "./punch-form";

export default async function PunchPage() {
  const user = await requireEmployee();
  const now = new Date();
  const today = workDateOf(now);

  const todays = await db
    .select()
    .from(punches)
    .where(
      and(
        eq(punches.userId, user.id),
        eq(punches.workDate, today),
        isNull(punches.voidedAt),
      ),
    )
    .orderBy(asc(punches.at));

  const next = nextPunchType(todays);
  const byType = new Map(todays.map((p) => [p.type, p]));
  const firstName = user.name.split(" ")[0];
  const hour = Number(formatTime(now).slice(0, 2));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center">
        <p className="text-lg text-slate-700">
          {greeting}, <strong>{firstName}</strong>!
        </p>
        <p className="text-sm text-slate-500">{longDateLabel(today)}</p>
      </div>

      <div className={`${cardClass} space-y-5 text-center`}>
        <Clock serverTime={now.getTime()} />
        <PunchForm
          next={next}
          actionLabel={next ? PUNCH_ACTION[next] : ""}
          punchLabel={next ? PUNCH_LABEL[next] : ""}
        />
      </div>

      <section aria-label="Registros de hoje" className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Hoje</h2>
        <ol className="grid grid-cols-2 gap-3">
          {PUNCH_ORDER.map((type) => {
            const punch = byType.get(type);
            const isNext = type === next;
            return (
              <li
                key={type}
                className={`rounded-xl border px-3 py-3 ${
                  punch
                    ? "border-emerald-200 bg-emerald-50"
                    : isNext
                      ? "border-emerald-600 bg-white ring-2 ring-emerald-600/20"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs font-medium text-slate-500">
                  {PUNCH_SHORT[type]}
                </p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    punch ? "text-emerald-800" : "text-slate-300"
                  }`}
                >
                  {punch ? formatTime(punch.at) : "--:--"}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
