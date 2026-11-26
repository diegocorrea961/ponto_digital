"use client";

import { useActionState, useState } from "react";
import type { PunchType } from "@/db/schema";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { punchAction, type PunchState } from "./actions";

export function PunchForm({
  next,
  actionLabel,
  punchLabel,
}: {
  next: PunchType | null;
  actionLabel: string;
  punchLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(
    async (prev: PunchState, formData: FormData) => {
      const result = await punchAction(prev, formData);
      setConfirming(false);
      return result;
    },
    undefined,
  );

  return (
    <div className="space-y-3">
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-xl px-4 py-3 text-center text-base font-medium ${
            state.ok
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
              : "bg-red-50 text-red-800 ring-1 ring-red-200"
          }`}
        >
          {state.message}
        </p>
      )}

      {next === null ? (
        <p className="rounded-xl bg-slate-100 px-4 py-4 text-center text-slate-700">
          Tudo certo por hoje. Bom descanso!
        </p>
      ) : confirming ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="expected" value={next} />
          <p className="text-center text-lg font-medium">
            Registrar <strong>{punchLabel.toLowerCase()}</strong> agora?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${btnSecondary} py-4 text-base`}
            >
              Cancelar
            </button>
            <SubmitButton pendingText="Registrando..." className="py-4 text-base">
              Confirmar
            </SubmitButton>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`${btnPrimary} w-full py-5 text-xl`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
