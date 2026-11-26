"use client";

import { useActionState, useState } from "react";
import type { PunchType } from "@/db/schema";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatDistance } from "@/lib/location";
import { LOCATION_HELP, readLocation } from "@/lib/read-location";
import { confirmLocationAction, punchAction, type PunchState } from "./actions";

/** Depois de gravada fora da rede da loja, tenta confirmar pelo GPS e ajusta o aviso. */
async function confirmByGps(saved: NonNullable<PunchState>): Promise<PunchState> {
  const reading = await readLocation();
  if (!reading.ok) {
    return { ...saved, warning: `${saved.warning} ${LOCATION_HELP[reading.reason]}` };
  }
  const result = await confirmLocationAction({
    punchId: saved.locate!,
    latitude: reading.latitude,
    longitude: reading.longitude,
    accuracy: reading.accuracy,
  }).catch(() => null);

  if (result?.check === "GPS") return { ...saved, warning: undefined };
  if (result?.check === "OUTSIDE") {
    return {
      ...saved,
      warning: `Você parece estar fora da loja (${formatDistance(result.distance)}). A administradora verá este aviso.`,
    };
  }
  return saved; // sem confirmação: mantém o aviso original
}

export function PunchForm({
  next,
  actionLabel,
  punchLabel,
  usesLocation,
}: {
  next: PunchType | null;
  actionLabel: string;
  punchLabel: string;
  /** A loja tem localização cadastrada: avisa que o aparelho pode pedir permissão. */
  usesLocation: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [locating, setLocating] = useState(false);
  const [state, action] = useActionState(
    async (prev: PunchState, formData: FormData) => {
      const result = await punchAction(prev, formData);
      setConfirming(false);
      if (!result?.locate) return result;
      setLocating(true);
      try {
        return await confirmByGps(result);
      } finally {
        setLocating(false);
      }
    },
    undefined,
  );

  // Enquanto confere o local, os botões somem para não empilhar outra batida.
  if (locating) {
    return (
      <p
        role="status"
        className="rounded-xl bg-sky-50 px-4 py-4 text-center text-base font-medium text-sky-800 ring-1 ring-sky-200"
      >
        Ponto registrado. Conferindo se você está na loja… Se o aparelho pedir, permita a
        localização.
      </p>
    );
  }

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
      {state?.warning && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900 ring-1 ring-amber-300"
        >
          {state.warning}
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

      {usesLocation && next !== null && (
        <p className="text-center text-xs text-slate-500">
          Fora do Wi-Fi da loja, a localização é lida só no momento em que você registra o ponto.
        </p>
      )}
    </div>
  );
}
