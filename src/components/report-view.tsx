import type { BankSummary, MonthReport } from "@/lib/report";
import { TOLERANCE_MINUTES } from "@/lib/schedule";
import { formatBalance, formatDuration, formatDateBR, monthLabel, workDateOf } from "@/lib/time";
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
  const { totals, bank } = report;
  const avg =
    totals.daysWorked > 0 ? Math.round(totals.minutes / totals.daysWorked) : 0;
  const hasPlaceChecks = report.rows.some((r) =>
    Object.values(r.byType).some((p) => p.locationCheck),
  );

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

      {bank ? (
        <BankPanel bank={bank} />
      ) : (
        editable && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
            Sem jornada neste período, então não há banco de horas. Cadastre ou ajuste a data de
            início em Funcionários → Editar.
          </p>
        )
      )}

      <MonthTable report={report} editable={editable} />

      <p className="text-xs text-slate-500">
        <sup className="text-sky-700">*</sup> Batida lançada manualmente pelo
        administrador (o motivo aparece em Observações). Os totais descontam o
        intervalo do almoço.
        {totals.manualPunches > 0 && ` Neste mês: ${totals.manualPunches} lançamento(s) manual(is).`}
        {bank &&
          ` Banco de horas desde ${formatDateBR(bank.since)}: diferenças de até ${TOLERANCE_MINUTES} minutos no dia não contam; o dia de hoje entra depois da saída, e dias com batida faltando ficam fora do saldo.`}
        {hasPlaceChecks &&
          " Local: “GPS” = confirmada pela localização; “!” = fora da loja ou local não confirmado; sem marca = rede da loja ou batida sem conferência."}
      </p>

      <div className="hidden grid-cols-2 gap-10 pt-16 text-center text-xs print:grid">
        <div className="border-t border-slate-500 pt-1">{report.user.name}</div>
        <div className="border-t border-slate-500 pt-1">Responsável pela loja</div>
      </div>
    </div>
  );
}

function BankPanel({ bank }: { bank: BankSummary }) {
  const pending = bank.pendingMonth + bank.pendingPrevious;
  return (
    <section aria-label="Banco de horas" className="space-y-2">
      {bank.accumulated < 0 && (
        <div
          role="status"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 print:rounded-none print:bg-transparent print:px-1 print:py-1"
        >
          <p className="text-lg font-semibold print:text-sm">
            Horas pendentes para pagar: {formatDuration(-bank.accumulated)}
          </p>
          <p className="text-sm print:text-xs">
            Já descontadas as horas extras feitas. Ao trabalhar mais de {TOLERANCE_MINUTES}{" "}
            minutos além da jornada em um dia, esse valor diminui sozinho.
          </p>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4 print:gap-1">
        <Stat label="Saldo anterior" value={formatBalance(bank.previous)} />
        <Stat label="Saldo do mês" value={formatBalance(bank.month)} />
        <Stat
          label="Saldo acumulado"
          value={formatBalance(bank.accumulated)}
          warn={bank.accumulated < 0}
        />
        <Stat
          label="Faltas / dias com atraso"
          value={`${bank.absences} / ${bank.lateDays}`}
          warn={bank.absences > 0}
        />
      </dl>
      {pending > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 print:bg-transparent print:p-0 print:text-xs">
          {pending} dia(s) com batida faltando fora do saldo ({bank.pendingMonth} neste mês,{" "}
          {bank.pendingPrevious} em meses anteriores). Lance as batidas para entrarem na conta.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-none print:p-1 print:shadow-none">
      <dt className="text-sm text-slate-500 print:text-xs">{label}</dt>
      <dd
        className={`text-2xl font-semibold tabular-nums print:text-sm ${warn ? "text-amber-700" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
