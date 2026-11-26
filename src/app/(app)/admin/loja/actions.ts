"use server";

// Rede e localização da loja (só administrador).
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { FormState } from "@/components/form-message";
import { requireAdmin } from "@/lib/auth";
import { MAX_RADIUS, MIN_RADIUS, parseCoordinates } from "@/lib/location";
import { clientNetwork } from "@/lib/network";
import { getStoreSettings, saveStoreSettings } from "@/lib/store";

const MAX_NETWORKS = 10;

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ponto", "layout");
}

export async function addNetworkAction(): Promise<FormState> {
  const admin = await requireAdmin();

  // A rede vem da própria requisição: não dá para digitar (nem errar) o endereço.
  const network = clientNetwork(await headers());
  if (!network) return { error: "Não consegui identificar a sua conexão." };

  const { networks } = await getStoreSettings();
  if (networks.includes(network)) return { success: "Essa rede já está cadastrada." };
  if (networks.length >= MAX_NETWORKS) {
    return { error: "Há redes demais cadastradas. Remova as antigas antes de adicionar." };
  }
  await saveStoreSettings({ networks: [...networks, network] }, admin.id);

  refresh();
  return { success: `Rede ${network} adicionada.` };
}

export async function removeNetworkAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const network = String(formData.get("network") ?? "");
  const { networks } = await getStoreSettings();
  if (!networks.includes(network)) return { error: "Rede não encontrada." };
  await saveStoreSettings({ networks: networks.filter((n) => n !== network) }, admin.id);

  refresh();
  return { success: "Rede removida." };
}

export async function saveLocationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const coords = parseCoordinates(String(formData.get("coordinates") ?? ""));
  if (!coords) {
    return { error: "Informe a latitude e a longitude, por exemplo: -23.550520, -46.633308" };
  }
  const radius = z.coerce
    .number()
    .int()
    .min(MIN_RADIUS)
    .max(MAX_RADIUS)
    .safeParse(formData.get("radius"));
  if (!radius.success) {
    return { error: `O raio deve ser um número entre ${MIN_RADIUS} e ${MAX_RADIUS} metros.` };
  }
  await saveStoreSettings({ ...coords, radiusMeters: radius.data }, admin.id);

  refresh();
  return { success: "Localização da loja salva." };
}

export async function clearLocationAction(): Promise<FormState> {
  const admin = await requireAdmin();
  await saveStoreSettings({ latitude: null, longitude: null }, admin.id);
  refresh();
  return { success: "Localização removida: o GPS não será mais pedido." };
}
