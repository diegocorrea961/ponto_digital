import Link from "next/link";
import { monthLabel, shiftMonth, workDateOf } from "@/lib/time";
import { btnSecondary } from "./ui";

/** Setas para o mês anterior / seguinte. `base` é o caminho + parâmetros que ficam (ex.: "/admin/relatorios?f=123"). */
export function MonthNav({ month, base }: { month: string; base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  const href = (m: string) => `${base}${sep}mes=${m}`;
  const current = workDateOf(new Date()).slice(0, 7);
  const next = shiftMonth(month, 1);
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Link href={href(shiftMonth(month, -1))} className={btnSecondary} aria-label="Mês anterior">
        ←
      </Link>
      <span className="min-w-36 text-center font-medium">{monthLabel(month)}</span>
      {next <= current ? (
        <Link href={href(next)} className={btnSecondary} aria-label="Próximo mês">
          →
        </Link>
      ) : (
        <span className={`${btnSecondary} pointer-events-none opacity-40`} aria-hidden>
          →
        </span>
      )}
    </div>
  );
}
