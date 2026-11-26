"use client";

import { useActionState, useState } from "react";
import {
  addManualPunchAction,
  voidPunchAction,
} from "@/app/(app)/admin/actions";
import type { PunchType } from "@/db/schema";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { inputClass } from "./ui";

export type Cell = { time: string; manual: boolean } | null;

export type AdjustPunch = {
  id: string;
  label: string;
  time: string;
  manual: boolean;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
};

export type AdjustData = {
  userId: string;
  punches: AdjustPunch[];
  missing: { value: PunchType; label: string }[];
};

export type RowData = {
  date: string; // YYYY-MM-DD
  day: string; // "26"
  weekday: string; // "qui"
  muted: boolean; // domingo ou dia futuro
  cells: Record<PunchType, Cell>;
  total: string | null;
  status: "ok" | "incomplete" | "empty";
  notes: string[];
};

const COLUMNS: PunchType[] = ["ENTRY", "LUNCH_OUT", "LUNCH_IN", "EXIT"];

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
                </span>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </td>
          );
        })}
        <td className="px-3 py-2 text-center font-medium tabular-nums">{row.total ?? ""}</td>
        <td className="px-3 py-2 text-xs">
          {row.status === "incomplete" && (
            <span className="mr-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 print:bg-transparent print:p-0">
              Incompleto
            </span>
          )}
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
          <td colSpan={7} className="px-3 py-4">
            <AdjustPanel date={row.date} adjust={adjust} />
          </td>
        </tr>
      )}
    </>
  );
}

function AdjustPanel({ date, adjust }: { date: string; adjust: AdjustData }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
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
        <AddSection userId={adjust.userId} date={date} missing={adjust.missing} />
      </div>
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
