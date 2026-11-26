"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { WeekSchedule } from "@/db/schema";
import { removeScheduleAction, setScheduleAction } from "./schedule-actions";
import { ScheduleFields } from "./schedule-fields";

export type ScheduleHistoryItem = {
  id: string;
  validFrom: string; // já formatada: 26/11/2026
  current: boolean;
  lines: { name: string; text: string }[];
};

export function SetScheduleForm({
  userId,
  initial,
  today,
}: {
  userId: string;
  initial?: WeekSchedule;
  today: string;
}) {
  const [state, action] = useActionState(setScheduleAction, undefined);
  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <ScheduleFields initial={initial} defaultValidFrom={today} />
      <FormMessage state={state} />
      <SubmitButton>Salvar jornada</SubmitButton>
    </form>
  );
}

export function ScheduleHistory({ items }: { items: ScheduleHistoryItem[] }) {
  const [state, action] = useActionState(removeScheduleAction, undefined);
  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      {items.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sem jornada cadastrada: o relatório soma as horas, mas não calcula banco de horas.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  A partir de {item.validFrom}
                  {item.current && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      valendo hoje
                    </span>
                  )}
                </p>
                <form
                  action={action}
                  onSubmit={(e) => {
                    if (!confirm("Remover esta jornada? O banco de horas será recalculado.")) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="scheduleId" value={item.id} />
                  <SubmitButton variant="secondary" pendingText="..." className="px-3 py-1.5">
                    Remover
                  </SubmitButton>
                </form>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                {item.lines.map((line) => (
                  <li key={line.name}>
                    <strong>{line.name}:</strong> {line.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
