// Regras de conferência de local. Sem banco e sem APIs do servidor: pode ser usado em qualquer lado.
import type { LocationCheck } from "@/db/schema";

export const DEFAULT_RADIUS = 100;
export const MIN_RADIUS = 30;
export const MAX_RADIUS = 1000;
/** GPS com margem de erro maior que isto não serve para confirmar que a pessoa está na loja. */
export const MAX_ACCURACY_METERS = 150;
/** Prazo para o GPS ser anexado à batida recém-gravada. */
export const ATTACH_WINDOW_MINUTES = 2;

export type Coords = { latitude: number; longitude: number };
export type GpsReading = Coords & { accuracy: number };

export type StoreLocation = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  networks: string[];
};

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceMeters(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function storeCoords(store: StoreLocation): Coords | null {
  return store.latitude === null || store.longitude === null
    ? null
    : { latitude: store.latitude, longitude: store.longitude };
}

/**
 * Primeira conferência, pela rede. null = nada configurado (conferência desligada).
 * UNCONFIRMED pode melhorar depois com o GPS.
 */
export function checkByNetwork(
  store: StoreLocation,
  network: string | null,
): LocationCheck | null {
  if (store.networks.length === 0 && !storeCoords(store)) return null;
  return network !== null && store.networks.includes(network) ? "NETWORK" : "UNCONFIRMED";
}

/**
 * - GPS: dentro do raio, com precisão aceitável;
 * - OUTSIDE: fora do raio mesmo descontando a margem de erro;
 * - UNCONFIRMED: a margem de erro não permite afirmar nem uma coisa nem outra.
 */
export function checkByGps(store: Coords, radiusMeters: number, reading: GpsReading) {
  const distance = distanceMeters(store, reading);
  const check: LocationCheck =
    distance <= radiusMeters && reading.accuracy <= MAX_ACCURACY_METERS
      ? "GPS"
      : distance - reading.accuracy > radiusMeters
        ? "OUTSIDE"
        : "UNCONFIRMED";
  return { check, distance: Math.round(distance), accuracy: Math.round(reading.accuracy) };
}

/** 35 -> "35 m"; 2345 -> "2,3 km" */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function describePlace(check: LocationCheck, distance: number | null): string {
  const far = distance === null ? "" : ` (${formatDistance(distance)})`;
  switch (check) {
    case "NETWORK":
      return "Confirmada pela rede da loja";
    case "GPS":
      return `Confirmada pelo GPS${far}`;
    case "OUTSIDE":
      return `Fora da loja${far}`;
    case "UNCONFIRMED":
      return "Local não confirmado";
  }
}

/** Aceita o formato copiado do Google Maps: "-23.550520, -46.633308". */
export function parseCoordinates(text: string): Coords | null {
  const match = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
