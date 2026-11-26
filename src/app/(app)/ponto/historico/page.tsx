import { MonthNav } from "@/components/month-nav";
import { PrintButton } from "@/components/print-button";
import { ReportView } from "@/components/report-view";
import { requireEmployee } from "@/lib/auth";
import { getMonthReport } from "@/lib/report";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireEmployee();
  const { mes } = await searchParams;
  const report = (await getMonthReport(user.id, mes))!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-semibold">Meu histórico</h1>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav month={report.month.key} base="/ponto/historico" />
          <PrintButton />
        </div>
      </div>
      <ReportView report={report} storeName={process.env.STORE_NAME ?? ""} />
    </div>
  );
}
