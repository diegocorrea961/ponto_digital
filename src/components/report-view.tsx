import type { MonthReport } from "@/lib/report";
import { formatDuration, formatDateBR, monthLabel, workDateOf } from "@/lib/time";
import { MonthTable } from "./month-table";

/** Espelho de ponto do mês: cabeçalho de impressão, resumo, tabela e linhas de assinatura. */
export function ReportView({
  report,
  storeName,
  editable = false,
}: {
  report: MonthReport;
  storeName: string;
  editable?: boolean;
}) {
  const { totals } = report;
  const avg =
    totals.daysWorked > 0 ? Math.round(totals.minutes / totals.daysWorked) : 0;

  return (
    <div className="space-y-4">
      {/* Só aparece na impressão */}
      <div className="hidden print:block">
        <p className="text-xs uppercase tracking-wide text-slate-500">{storeName}</p>
        <h1 className="text-lg font-semibold">Espelho de ponto</h1>
        <p>
          Funcionário: <strong>{report.user.name}</strong> · Período:{" "}
          <strong>{monthLabel(report.month.key)}</strong>
        </p>
        <p className="text-xs text-slate-500">
          Emitido em {formatDateBR(workDateOf(new Date()))}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        <Stat label="Dias trabalhados" value={String(totals.daysWorked)} />
        <Stat label="Total de horas" value={formatDuration(totals.minutes)} />
        <Stat label="Média por dia" value={totals.daysWorked ? formatDuration(avg) : "—"} />
        <Stat
          label="Dias incompletos"
          value={String(totals.incompleteDays)}
          warn={totals.incompleteDays > 0}
        />
      </dl>

      <MonthTable report={report} editable={editable} />

      <p className="text-xs text-slate-500">
        <sup className="text-sky-700">*</sup> Batida lançada manualmente pelo
        administrador (o motivo aparece em Observações). Os totais descontam o
        intervalo do almoço.
        {totals.manualPunches > 0 && ` Neste mês: ${totals.manualPunches} lançamento(s) manual(is).`}
      </p>

      <div className="hidden grid-cols-2 gap-10 pt-16 text-center text-xs print:grid">
        <div className="border-t border-slate-500 pt-1">{report.user.name}</div>
        <div className="border-t border-slate-500 pt-1">Responsável pela loja</div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`text-2xl font-semibold tabular-nums ${warn ? "text-amber-700" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
