import { and, asc, eq, isNull } from "drizzle-orm";
import { AutoRefresh } from "@/components/auto-refresh";
import { cardClass } from "@/components/ui";
import { db } from "@/db";
import { punches, users, type Punch, type PunchType } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PUNCH_ORDER, PUNCH_SHORT } from "@/lib/punches";
import { formatTime, longDateLabel, workDateOf } from "@/lib/time";

type Status = "working" | "lunch" | "done" | "absent";

const STATUS_LABEL: Record<Status, string> = {
  working: "Trabalhando",
  lunch: "No almoço",
  done: "Encerrou o dia",
  absent: "Ainda não chegou",
};

const STATUS_STYLE: Record<Status, string> = {
  working: "bg-emerald-100 text-emerald-800",
  lunch: "bg-amber-100 text-amber-800",
  done: "bg-slate-200 text-slate-700",
  absent: "bg-red-50 text-red-700",
};

function statusOf(byType: Partial<Record<PunchType, Punch>>): Status {
  if (byType.EXIT) return "done";
  if (byType.LUNCH_OUT && !byType.LUNCH_IN) return "lunch";
  if (byType.ENTRY || byType.LUNCH_IN) return "working";
  return "absent";
}

export default async function AdminHome() {
  await requireAdmin();
  const today = workDateOf(new Date());

  const employees = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "EMPLOYEE"), eq(users.active, true)))
    .orderBy(asc(users.name));

  const todays = await db
    .select()
    .from(punches)
    .where(and(eq(punches.workDate, today), isNull(punches.voidedAt)));

  const rows = employees.map((e) => {
    const byType: Partial<Record<PunchType, Punch>> = {};
    for (const p of todays) if (p.userId === e.id) byType[p.type] = p;
    return { ...e, byType, status: statusOf(byType) };
  });

  const count = (s: Status) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={60} />
      <div>
        <h1 className="text-xl font-semibold">Hoje</h1>
        <p className="text-sm text-slate-500">{longDateLabel(today)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["working", "lunch", "done", "absent"] as Status[]).map((s) => (
          <div key={s} className={cardClass}>
            <p className="text-3xl font-semibold tabular-nums">{count(s)}</p>
            <p className="text-sm text-slate-500">{STATUS_LABEL[s]}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
          Cadastre o primeiro funcionário em &quot;Funcionários&quot; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Funcionário</th>
                {PUNCH_ORDER.map((t) => (
                  <th key={t} className="px-3 py-2 text-center">
                    {PUNCH_SHORT[t]}
                  </th>
                ))}
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="px-3 py-2.5 font-medium">{r.name}</td>
                  {PUNCH_ORDER.map((t) => (
                    <td key={t} className="px-3 py-2.5 text-center tabular-nums">
                      {r.byType[t] ? formatTime(r.byType[t]!.at) : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
