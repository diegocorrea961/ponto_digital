// Lê a localização do aparelho (só no navegador, e só quando chamada).
import type { GpsReading } from "./location";

export type LocationFailure = "denied" | "unavailable" | "timeout" | "unsupported";

export type LocationResult =
  | ({ ok: true } & GpsReading)
  | { ok: false; reason: LocationFailure };

export const LOCATION_HELP: Record<LocationFailure, string> = {
  denied: "O acesso à localização está bloqueado. Libere nas permissões do navegador.",
  unavailable: "O aparelho não conseguiu obter a localização. Confira se o GPS está ligado.",
  timeout: "A localização demorou demais para responder.",
  unsupported: "Este navegador não informa a localização (o endereço precisa começar com https).",
};

export function readLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    // Reforço: se o aviso de permissão ficar sem resposta, o `timeout` do navegador não dispara.
    const fallback = setTimeout(() => resolve({ ok: false, reason: "timeout" }), 20_000);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(fallback);
        resolve({
          ok: true,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
      },
      (error) => {
        clearTimeout(fallback);
        const reason = error.code === 1 ? "denied" : error.code === 3 ? "timeout" : "unavailable";
        resolve({ ok: false, reason });
      },
      // maximumAge 0: nunca aproveita uma posição antiga (ex.: lida mais cedo, ainda na loja).
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
