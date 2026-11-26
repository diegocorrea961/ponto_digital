"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { btnSecondary, inputClass, labelClass } from "@/components/ui";
import { MAX_RADIUS, MIN_RADIUS } from "@/lib/location";
import { LOCATION_HELP, readLocation } from "@/lib/read-location";
import {
  addNetworkAction,
  clearLocationAction,
  removeNetworkAction,
  saveLocationAction,
} from "./actions";

export function NetworkForms({
  current,
  networks,
}: {
  current: string | null;
  networks: string[];
}) {
  // Um estado só para adicionar e remover: a mensagem aparece sempre no mesmo lugar.
  const [state, action] = useActionState(
    async (prev: FormState, formData: FormData) =>
      formData.has("network") ? removeNetworkAction(prev, formData) : addNetworkAction(),
    undefined,
  );
  const registered = current !== null && networks.includes(current);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        Sua conexão agora: <strong className="break-all">{current ?? "não identificada"}</strong>
        {registered && (
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            cadastrada
          </span>
        )}
      </p>

      {networks.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nenhuma rede cadastrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {networks.map((network) => (
            <li
              key={network}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="break-all">{network}</span>
              <form action={action}>
                <input type="hidden" name="network" value={network} />
                <SubmitButton variant="secondary" pendingText="..." className="px-3 py-1.5">
                  Remover
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <FormMessage state={state} />
      {current !== null && !registered && (
        <form action={action}>
          <SubmitButton pendingText="Adicionando...">Adicionar a rede em que estou</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function LocationForm({
  coordinates,
  radius,
}: {
  coordinates: string;
  radius: number;
}) {
  const [value, setValue] = useState(coordinates);
  const [meters, setMeters] = useState(String(radius));
  const [reading, setReading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [state, action] = useActionState(
    async (prev: FormState, formData: FormData) => {
      if (!formData.has("clear")) return saveLocationAction(prev, formData);
      const result = await clearLocationAction();
      setValue("");
      return result;
    },
    undefined,
  );

  async function useMyLocation() {
    setReading(true);
    setHint(null);
    const result = await readLocation();
    setReading(false);
    if (!result.ok) {
      setHint(LOCATION_HELP[result.reason]);
      return;
    }
    setValue(`${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);
    const accuracy = Math.round(result.accuracy);
    setHint(
      accuracy > 50
        ? `Precisão baixa (margem de ${accuracy} m). Use o celular dentro da loja ou cole as coordenadas do Google Maps. Depois, salve.`
        : `Localização lida (margem de ${accuracy} m). Confira se você está na loja e salve.`,
    );
  }

  return (
    // onReset: um erro do servidor não apaga o que foi digitado.
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-3">
      <button type="button" onClick={useMyLocation} disabled={reading} className={btnSecondary}>
        {reading ? "Lendo localização..." : "Usar minha localização atual"}
      </button>
      {hint && (
        <p role="status" className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {hint}
        </p>
      )}
      <label className="block">
        <span className={labelClass}>Coordenadas da loja (latitude, longitude)</span>
        <input
          name="coordinates"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="-23.550520, -46.633308"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-slate-500">
          No Google Maps do computador, clique com o botão direito sobre a loja e clique nos números
          que aparecem para copiar.
        </span>
      </label>
      <label className="block">
        <span className={labelClass}>Raio permitido (metros)</span>
        <input
          type="number"
          name="radius"
          required
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          value={meters}
          onChange={(e) => setMeters(e.target.value)}
          className={inputClass}
        />
      </label>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton>Salvar localização</SubmitButton>
        {coordinates !== "" && (
          <button type="submit" name="clear" value="1" formNoValidate className={btnSecondary}>
            Remover localização
          </button>
        )}
      </div>
    </form>
  );
}
