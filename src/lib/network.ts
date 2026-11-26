// De qual rede de internet veio a requisição (só no servidor).
import { isIP } from "node:net";

/**
 * Identifica a rede a partir do IP:
 *  - IPv4: o próprio endereço (todos os aparelhos do mesmo roteador saem com ele);
 *  - IPv6: os primeiros 64 bits (cada aparelho tem um endereço, mas o prefixo é o da rede).
 */
export function networkKey(ip: string): string | null {
  let value = ip.trim().toLowerCase().split("%")[0];
  if (value.startsWith("::ffff:") && isIP(value.slice(7)) === 4) value = value.slice(7);
  if (value === "::1") value = "127.0.0.1"; // o próprio computador, em desenvolvimento

  const kind = isIP(value);
  if (kind === 4) return value;
  if (kind !== 6) return null;

  // Expande o "::" para pegar os 4 primeiros grupos.
  const [head, tail] = value.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? 0 : Math.max(0, 8 - left.length - right.length);
  const groups = [...left, ...Array<string>(zeros).fill("0"), ...right];
  const prefix = groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

/**
 * Na Vercel o x-forwarded-for é preenchido pela própria plataforma (o cliente não consegue
 * falsificar). Em outro host, só confie nele se houver um proxy seu que o sobrescreva.
 */
export function clientNetwork(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0];
  return forwarded ? networkKey(forwarded) : null;
}
