import { PUNCH_LABEL, PUNCH_ORDER, PUNCH_SHORT } from "@/lib/punches";
import type { MonthReport } from "@/lib/report";
import { formatDuration, formatTime, workDateOf } from "@/lib/time";
import type { PunchType } from "@/db/schema";
import { ReportRow, type AdjustData, type Cell, type RowData } from "./report-row";

/** Tabela do mês (espelho de ponto). Com `editable`, o administrador vê o botão "Ajustar" em cada dia. */
export function MonthTable({
  report,
  editable = false,
}: {
  report: MonthReport;
  editable?: boolean;
}) {
  const today = workDateOf(new Date());

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white print:overflow-visible print:rounded-none print:border-slate-400">
      <table className="w-full min-w-[640px] text-sm print:min-w-0">
        <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 print:bg-transparent">
          <tr>
            <th className="px-3 py-2">Dia</th>
            {PUNCH_ORDER.map((t) => (
              <th key={t} className="px-3 py-2 text-center">
                {PUNCH_SHORT[t]}
              </th>
            ))}
            <th className="px-3 py-2 text-center">Total</th>
            <th className="px-3 py-2">Observações</th>
            {editable && <th className="px-3 py-2 print:hidden" aria-label="Ajustes" />}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r) => {
            const cells = {} as Record<PunchType, Cell>;
            for (const t of PUNCH_ORDER) {
              const p = r.byType[t];
              cells[t] = p ? { time: formatTime(p.at), manual: p.source === "MANUAL" } : null;
            }

            const notes = r.all
              .filter((p) => !p.voidedAt && p.source === "MANUAL")
              .map((p) => `${PUNCH_SHORT[p.type]} lançada manualmente${p.note ? `: ${p.note}` : ""}`);

            const row: RowData = {
              date: r.date,
              day: r.date.slice(8),
              weekday: weekdayLabel(r.weekday),
              muted: (r.weekday === 0 || r.isFuture) && !r.hasPunches,
              cells,
              total: r.hasPunches ? formatDuration(r.minutes) : null,
              status: !r.hasPunches
                ? "empty"
                : !r.complete && r.date !== today
                  ? "incomplete"
                  : "ok",
              notes,
            };

            let adjust: AdjustData | undefined;
            if (editable) {
              const missing = PUNCH_ORDER.filter((t) => !r.byType[t]).map((t) => ({
                value: t,
                label: PUNCH_LABEL[t],
              }));
              adjust = {
                userId: report.user.id,
                missing: r.isFuture ? [] : missing,
                punches: r.all.map((p) => ({
                  id: p.id,
                  label: PUNCH_LABEL[p.type],
                  time: formatTime(p.at),
                  manual: p.source === "MANUAL",
                  note: p.note,
                  voided: Boolean(p.voidedAt),
                  voidReason: p.voidReason,
                })),
              };
            }

            return <ReportRow key={r.date} row={row} adjust={adjust} />;
          })}
        </tbody>
        <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold print:bg-transparent">
          <tr>
            <td className="px-3 py-3" colSpan={5}>
              Total do mês ({report.totals.daysWorked}{" "}
              {report.totals.daysWorked === 1 ? "dia trabalhado" : "dias trabalhados"})
            </td>
            <td className="px-3 py-3 text-center tabular-nums">
              {formatDuration(report.totals.minutes)}
            </td>
            <td className="px-3 py-3" colSpan={editable ? 2 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function weekdayLabel(i: number) {
  return WEEKDAYS[i];
}
