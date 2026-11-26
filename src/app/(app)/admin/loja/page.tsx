import { headers } from "next/headers";
import { cardClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { storeCoords } from "@/lib/location";
import { clientNetwork } from "@/lib/network";
import { getStoreSettings } from "@/lib/store";
import { LocationForm, NetworkForms } from "./forms";

export default async function StorePage() {
  await requireAdmin();
  const [store, requestHeaders] = await Promise.all([getStoreSettings(), headers()]);
  const coords = storeCoords(store);
  const enabled = store.networks.length > 0 || coords !== null;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Local da loja</h1>
        <p className="text-sm text-slate-500">
          Serve para avisar quando uma batida é feita fora da loja. Nenhuma batida é bloqueada.
        </p>
      </div>

      {!enabled && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Conferência desligada: cadastre a rede ou a localização para ligar.
        </p>
      )}

      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-semibold">1. Rede da loja</h2>
        <p className="text-xs text-slate-500">
          Faça isto <strong>dentro da loja</strong>, com o aparelho no Wi-Fi ou no computador de lá.
          Se um dia a operadora mudar o endereço da internet, adicione de novo.
        </p>
        <NetworkForms current={clientNetwork(requestHeaders)} networks={store.networks} />
      </section>

      <section className={`${cardClass} space-y-3`}>
        <h2 className="font-semibold">2. Localização (reserva)</h2>
        <p className="text-xs text-slate-500">
          Usada quando a batida vem de fora da rede da loja, como um celular no 4G.
        </p>
        <LocationForm
          coordinates={coords ? `${coords.latitude}, ${coords.longitude}` : ""}
          radius={store.radiusMeters}
        />
      </section>
    </div>
  );
}
