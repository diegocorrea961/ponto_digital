"use client";

import { useActionState, useState } from "react";
import {
  addManualPunchAction,
  voidPunchAction,
} from "@/app/(app)/admin/actions";
import { addDayOffAction, removeDayOffAction } from "@/app/(app)/admin/schedule-actions";
import type { LocationCheck, PunchType } from "@/db/schema";
import type { DayBadge } from "@/lib/report-labels";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { inputClass } from "./ui";

export type Cell = { time: string; manual: boolean; place: LocationCheck | null } | null;

export type AdjustPunch = {
  id: string;
  label: string;
  time: string;
  manual: boolean;
  /** "Confirmada pela rede da loja", "Fora da loja (2,3 km)"… */
  place: string | null;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
};

export type AdjustData = {
  userId: string;
  isFuture: boolean;
  punches: AdjustPunch[];
  missing: { value: PunchType; label: string }[];
  dayOff: {
    id: string;
    label: string;
    reason: string;
    /** Preenchido quando o abono cobre mais de um dia. */
    period: string | null;
  } | null;
};

export type RowData = {
  date: string; // YYYY-MM-DD
  day: string; // "26"
  weekday: string; // "qui"
  muted: boolean; // dia sem trabalho previsto ou futuro
  cells: Record<PunchType, Cell>;
  total: string | null;
  /** null quando o funcionário não tem jornada (colunas Previsto/Saldo escondidas). */
  bank: { expected: string; balance: string; tone: "pos" | "neg" | "zero" } | null;
  badges: DayBadge[];
  notes: string[];
};

const COLUMNS: PunchType[] = ["ENTRY", "LUNCH_OUT", "LUNCH_IN", "EXIT"];

const BADGE_STYLE: Record<DayBadge["tone"], string> = {
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
};

const BALANCE_STYLE = { pos: "text-emerald-700", neg: "text-red-700", zero: "text-slate-500" };

export function ReportRow({
  row,
  adjust,
}: {
  row: RowData;
  adjust?: AdjustData;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className={`border-t border-slate-200 ${row.muted ? "bg-slate-50 text-slate-400" : ""}`}>
        <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">
          {row.day} <span className="font-normal uppercase">{row.weekday}</span>
        </td>
        {COLUMNS.map((t) => {
          const cell = row.cells[t];
          return (
            <td key={t} className="px-3 py-2 text-center tabular-nums">
              {cell ? (
                <span title={cell.manual ? "Lançada manualmente pelo administrador" : undefined}>
                  {cell.time}
                  {cell.manual && <sup className="ml-0.5 text-sky-700">*</sup>}
                  {cell.place === "GPS" && (
                    <sup className="ml-0.5 text-[10px] font-semibold text-slate-500">GPS</sup>
                  )}
                  {(cell.place === "OUTSIDE" || cell.place === "UNCONFIRMED") && (
                    <sup
                      className={`ml-0.5 font-bold ${cell.place === "OUTSIDE" ? "text-red-700" : "text-amber-700"}`}
                      title={cell.place === "OUTSIDE" ? "Fora da loja" : "Local não confirmado"}
                    >
                      !
                    </sup>
                  )}
                </span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
          );
        })}
        <td className="px-3 py-2 text-center font-medium tabular-nums">{row.total ?? ""}</td>
        {row.bank && (
          <>
            <td className="px-3 py-2 text-center tabular-nums">{row.bank.expected}</td>
            <td
              className={`whitespace-nowrap px-3 py-2 text-center font-medium tabular-nums ${BALANCE_STYLE[row.bank.tone]}`}
            >
              {row.bank.balance}
            </td>
          </>
        )}
        <td className="px-3 py-2 text-xs">
          {row.badges.map((b) => (
            <span
              key={b.text}
              className={`mb-0.5 mr-1 inline-block rounded px-1.5 py-0.5 font-medium print:bg-transparent print:p-0 ${BADGE_STYLE[b.tone]}`}
            >
              {b.text}
            </span>
          ))}
          {row.notes.map((n, i) => (
            <span key={i} className="block text-slate-600">
              {n}
            </span>
          ))}
        </td>
        {adjust && (
          <td className="px-3 py-2 text-right print:hidden">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {open ? "Fechar" : "Ajustar"}
            </button>
          </td>
        )}
      </tr>
      {adjust && open && (
        <tr className="bg-slate-50 print:hidden">
          <td colSpan={row.bank ? 10 : 8} className="px-3 py-4">
            <AdjustPanel date={row.date} adjust={adjust} />
          </td>
        </tr>
      )}
    </>
  );
}

function AdjustPanel({ date, adjust }: { date: string; adjust: AdjustData }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Batidas do dia</h3>
        {adjust.punches.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma batida neste dia.</p>
        ) : (
          <ul className="space-y-3">
            {adjust.punches.map((p) => (
              <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className={p.voided ? "text-slate-400 line-through" : "font-medium"}>
                  {p.label}: {p.time}
                  {p.manual && " (manual)"}
                </p>
                {p.place && <p className="text-xs text-slate-500">{p.place}</p>}
                {p.note && <p className="text-xs text-slate-500">Motivo do lançamento: {p.note}</p>}
                {p.voided ? (
                  <p className="text-xs text-red-700">Anulada. Motivo: {p.voidReason}</p>
                ) : (
                  <VoidForm punchId={p.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Lançar batida esquecida</h3>
        {adjust.isFuture ? (
          <p className="text-sm text-slate-500">Não dá para lançar batida em um dia futuro.</p>
        ) : (
          <AddSection userId={adjust.userId} date={date} missing={adjust.missing} />
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Abono do dia</h3>
        <DayOffSection userId={adjust.userId} date={date} dayOff={adjust.dayOff} />
      </div>
    </div>
  );
}

function DayOffSection({
  userId,
  date,
  dayOff,
}: {
  userId: string;
  date: string;
  dayOff: AdjustData["dayOff"];
}) {
  // Um estado só para lançar e remover: a mensagem continua visível quando o formulário troca.
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof addDayOffAction>>, formData: FormData) =>
      formData.has("dayOffId")
        ? removeDayOffAction(prev, formData)
        : addDayOffAction(prev, formData),
    undefined,
  );

  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      {dayOff ? (
        <form action={action} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <input type="hidden" name="dayOffId" value={dayOff.id} />
          <p className="font-medium">{dayOff.label}</p>
          <p className="text-xs text-slate-500">Motivo: {dayOff.reason}</p>
          {dayOff.period && (
            <p className="text-xs text-amber-700">
              Período de {dayOff.period}. Remover tira o abono do período inteiro.
            </p>
          )}
          <SubmitButton variant="danger" pendingText="..." className="px-3 py-1.5">
            Remover abono
          </SubmitButton>
        </form>
      ) : (
        // onReset: um erro do servidor não apaga o que foi digitado.
        <form action={action} onReset={(e) => e.preventDefault()} className="space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="startDate" value={date} />
          <select name="kind" required aria-label="Tipo do abono" className={`${inputClass} py-2 text-sm`}>
            <option value="HOLIDAY">Feriado ou folga</option>
            <option value="EXCUSED">Atestado ou abono</option>
          </select>
          <label className="block text-xs text-slate-500">
            Até (opcional, para férias ou vários dias)
            <input
              type="date"
              name="endDate"
              min={date}
              className={`${inputClass} mt-1 py-2 text-sm`}
            />
          </label>
          <input
            name="reason"
            required
            minLength={3}
            maxLength={200}
            placeholder="Motivo (ex.: feriado, atestado)"
            aria-label="Motivo do abono"
            className={`${inputClass} py-2 text-sm`}
          />
          <SubmitButton pendingText="Lançando...">Abonar</SubmitButton>
        </form>
      )}
    </div>
  );
}

function VoidForm({ punchId }: { punchId: string }) {
  const [state, action] = useActionState(voidPunchAction, undefined);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="punchId" value={punchId} />
      <div className="flex gap-2">
        <input
          name="reason"
          required
          minLength={3}
          maxLength={200}
          placeholder="Motivo para anular"
          aria-label="Motivo para anular"
          className={`${inputClass} py-1.5 text-sm`}
        />
        <SubmitButton variant="danger" pendingText="..." className="shrink-0 px-3 py-1.5">
          Anular
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function AddSection({
  userId,
  date,
  missing,
}: {
  userId: string;
  date: string;
  missing: AdjustData["missing"];
}) {
  const [state, action] = useActionState(addManualPunchAction, undefined);
  return (
    <div className="space-y-3">
      {/* A mensagem fica fora do formulário: quando o dia fica completo o formulário some, e o aviso precisa continuar visível. */}
      <FormMessage state={state} />
      {missing.length === 0 ? (
        <p className="text-sm text-slate-500">
          O dia já tem as 4 batidas. Para corrigir um horário, anule a batida errada e lance a certa.
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="workDate" value={date} />
          <div className="grid grid-cols-2 gap-3">
            <select name="type" required aria-label="Tipo da batida" className={`${inputClass} py-2 text-sm`}>
              {missing.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="time"
              name="time"
              required
              aria-label="Horário"
              className={`${inputClass} py-2 text-sm`}
            />
          </div>
          <input
            name="note"
            required
            minLength={3}
            maxLength={200}
            placeholder="Motivo (ex.: esqueceu de bater)"
            aria-label="Motivo do lançamento"
            className={`${inputClass} py-2 text-sm`}
          />
          <SubmitButton pendingText="Lançando...">Lançar batida</SubmitButton>
        </form>
      )}
    </div>
  );
}
