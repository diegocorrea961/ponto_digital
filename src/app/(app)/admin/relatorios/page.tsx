import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { MonthNav } from "@/components/month-nav";
import { PrintButton } from "@/components/print-button";
import { ReportView } from "@/components/report-view";
import { btnPrimary, btnSecondary, cardClass, inputClass, labelClass } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getMonthReport } from "@/lib/report";
import { parseMonth } from "@/lib/time";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; mes?: string }>;
}) {
  await requireAdmin();
  const { f, mes } = await searchParams;

  const employees = await db
    .select({ id: users.id, name: users.name, active: users.active })
    .from(users)
    .where(eq(users.role, "EMPLOYEE"))
    .orderBy(asc(users.name));

  const selected =
    f && z.uuid().safeParse(f).success && employees.some((e) => e.id === f) ? f : undefined;
  const report = selected ? await getMonthReport(selected, mes) : null;
  const month = parseMonth(mes).key;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold print:hidden">Relatórios de ponto</h1>

      <form method="get" className={`${cardClass} flex flex-wrap items-end gap-4 print:hidden`}>
        <div className="min-w-48 flex-1">
          <label htmlFor="f" className={labelClass}>
            Funcionário
          </label>
          <select id="f" name="f" required defaultValue={selected ?? ""} className={inputClass}>
            <option value="" disabled>
              Escolha…
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.active ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mes" className={labelClass}>
            Mês
          </label>
          <input
            id="mes"
            name="mes"
            type="month"
            required
            defaultValue={month}
            pattern="\d{4}-\d{2}"
            className={inputClass}
          />
        </div>
        <button type="submit" className={btnPrimary}>
          Gerar relatório
        </button>
      </form>

      {employees.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
          Cadastre um funcionário para gerar relatórios.
        </p>
      )}

      {report && selected && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-lg font-semibold">{report.user.name}</h2>
              {!report.user.active && <p className="text-xs text-slate-500">Funcionário inativo</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <MonthNav month={report.month.key} base={`/admin/relatorios?f=${selected}`} />
              <a
                href={`/admin/relatorios/csv?f=${selected}&mes=${report.month.key}`}
                className={btnSecondary}
              >
                Baixar planilha (CSV)
              </a>
              <PrintButton />
            </div>
          </div>
          <ReportView report={report} storeName={process.env.STORE_NAME ?? ""} editable />
        </>
      )}
    </div>
  );
}
