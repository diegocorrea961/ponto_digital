"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/components/ui";
import type { WeekSchedule } from "@/db/schema";
import {
  buildDay,
  DEFAULT_CLOSE,
  DEFAULT_OPEN,
  toClock,
  TOLERANCE_MINUTES,
  WEEKDAYS,
  type DayInput,
} from "@/lib/schedule";
import { formatDuration } from "@/lib/time";

type DayState = DayInput & { on: boolean };

const EMPTY: DayState = {
  on: false,
  fixedHours: false,
  fixedLunch: false,
  start: "",
  end: "",
  lunchStart: "",
  lunchEnd: "",
  lunch: "60",
  duration: "",
  open: DEFAULT_OPEN,
  close: DEFAULT_CLOSE,
};

function initialState(week?: WeekSchedule): Record<number, DayState> {
  return Object.fromEntries(
    WEEKDAYS.map(({ index }) => {
      const day = week?.[String(index)];
      if (!day) return [index, EMPTY];
      const fixedHours = day.start !== null;
      return [
        index,
        {
          on: true,
          fixedHours,
          fixedLunch: day.lunchStart !== null,
          start: day.start ?? "",
          end: day.end ?? "",
          lunchStart: day.lunchStart ?? "",
          lunchEnd: day.lunchEnd ?? "",
          lunch: String(day.lunch ?? 60),
          duration: fixedHours ? "" : toClock(day.minutes),
          open: fixedHours ? DEFAULT_OPEN : (day.open ?? ""),
          close: fixedHours ? DEFAULT_CLOSE : (day.close ?? ""),
        } satisfies DayState,
      ];
    }),
  );
}

type TextField = Exclude<keyof DayState, "on" | "fixedHours" | "fixedLunch">;

/**
 * Campos da jornada semanal + data de início. Os valores ficam em estado do React; o formulário
 * em volta precisa de onReset={(e) => e.preventDefault()} para o React não apagar o que foi
 * digitado quando o servidor devolve um erro.
 */
export function ScheduleFields({
  initial,
  defaultValidFrom,
}: {
  initial?: WeekSchedule;
  defaultValidFrom: string;
}) {
  const [days, setDays] = useState(() => initialState(initial));
  const [validFrom, setValidFrom] = useState(defaultValidFrom);

  const update = (index: number, patch: Partial<DayState>) =>
    setDays((all) => ({ ...all, [index]: { ...all[index], ...patch } }));

  const checked = WEEKDAYS.filter(({ index }) => days[index].on);

  function copyFirst() {
    const source = days[checked[0].index];
    setDays((all) => ({
      ...all,
      ...Object.fromEntries(checked.map(({ index }) => [index, { ...source }])),
    }));
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold text-slate-800">Jornada de trabalho</legend>
      <p className="text-xs text-slate-500">
        Marque os dias em que trabalha. Sem horário fixo, basta informar o total de horas: a pessoa
        escolhe quando entra, almoça e sai. Diferenças de até {TOLERANCE_MINUTES} minutos no dia não
        entram no banco de horas.
      </p>

      {WEEKDAYS.map(({ index, name }) => {
        const day = days[index];
        const built = day.on ? buildDay(day) : null;

        // Função (e não componente) para o campo não perder o foco a cada tecla.
        const field = (
          key: TextField,
          label: string,
          props: React.InputHTMLAttributes<HTMLInputElement>,
        ) => (
          <label className="block">
            <span className={labelClass}>{label}</span>
            <input
              name={`d${index}_${key}`}
              value={day[key]}
              onChange={(e) => update(index, { [key]: e.target.value })}
              className={inputClass}
              {...props}
            />
          </label>
        );

        const toggle = (key: "fixedHours" | "fixedLunch", formName: string, label: string) => (
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name={`d${index}_${formName}`}
              checked={day[key]}
              onChange={(e) => update(index, { [key]: e.target.checked })}
              className="size-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            {label}
          </label>
        );

        return (
          <div
            key={index}
            className={`rounded-xl border p-3 ${day.on ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}
          >
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name={`d${index}_on`}
                checked={day.on}
                onChange={(e) => update(index, { on: e.target.checked })}
                className="size-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span className="flex-1 text-sm font-medium text-slate-800">{name}</span>
              {built && "day" in built && (
                <span className="text-xs font-medium tabular-nums text-emerald-800">
                  {formatDuration(built.day.minutes)} no dia
                </span>
              )}
            </label>

            {day.on && (
              <div className="mt-3 space-y-3">
                {toggle("fixedHours", "fixed", "Horário fixo de entrada e saída")}
                {toggle("fixedLunch", "fixedLunch", "Horário fixo de almoço")}

                <div className="grid grid-cols-2 gap-3">
                  {day.fixedHours ? (
                    <>
                      {field("start", "Entrada", { type: "time", required: true })}
                      {field("end", "Saída", { type: "time", required: true })}
                    </>
                  ) : (
                    <div className="col-span-2">
                      {field("duration", "Total de horas no dia (hh:mm)", {
                        type: "text",
                        required: true,
                        inputMode: "numeric",
                        placeholder: "08:24",
                        pattern: "([01]?[0-9]|2[0-3]):[0-5][0-9]",
                        title: "Horas e minutos, por exemplo 08:24",
                      })}
                    </div>
                  )}
                  {day.fixedLunch && (
                    <>
                      {field("lunchStart", "Sai para o almoço", { type: "time", required: true })}
                      {field("lunchEnd", "Volta do almoço", { type: "time", required: true })}
                    </>
                  )}
                  {day.fixedHours && !day.fixedLunch &&
                    field("lunch", "Duração do almoço (min)", {
                      type: "number",
                      required: true,
                      min: 0,
                      max: 240,
                      step: 1,
                    })}
                  {!day.fixedHours && (
                    <>
                      {field("open", "Loja abre", { type: "time" })}
                      {field("close", "Loja fecha", { type: "time" })}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {checked.length > 1 && (
        <button
          type="button"
          onClick={copyFirst}
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          Copiar {checked[0].name.toLowerCase()} para os outros dias marcados
        </button>
      )}

      <label className="block">
        <span className={labelClass}>Jornada vale a partir de</span>
        <input
          type="date"
          name="validFrom"
          required
          min="2020-01-01"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-slate-500">
          O banco de horas conta a partir desta data. Dias anteriores não geram falta nem hora extra.
        </span>
      </label>
    </fieldset>
  );
}
