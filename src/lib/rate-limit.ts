// Limite de tentativas de login, guardado no banco (tabela login_attempts).
// Funciona com várias instâncias do servidor (Vercel) e sobrevive a reinícios.
//
// Dois contadores independentes, ambos numa janela de 15 minutos:
//  - por conta:  barra quem tenta adivinhar a senha de UM usuário, mesmo trocando de IP;
//  - por origem: barra quem testa MUITOS usuários a partir do mesmo IP.
import { inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

const MAX_PER_USER = 10;
const MAX_PER_IP = 20;
const WINDOW_MINUTES = 15;

const userKey = (username: string) => `u:${username}`;
const ipKey = (ip: string) => `ip:${ip}`;

/** true se a conta ou a origem já estourou o limite dentro da janela. */
export async function isLoginBlocked(username: string, ip: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(loginAttempts)
    .where(inArray(loginAttempts.key, [userKey(username), ipKey(ip)]));
  const now = Date.now();
  return rows.some(
    (r) =>
      r.resetAt.getTime() > now &&
      r.count >= (r.key.startsWith("u:") ? MAX_PER_USER : MAX_PER_IP),
  );
}

/** Soma 1 erro para a conta e para a origem (atômico: um único INSERT ... ON CONFLICT). */
export async function registerLoginFailure(username: string, ip: string) {
  for (const key of [userKey(username), ipKey(ip)]) {
    await db
      .insert(loginAttempts)
      .values({
        key,
        count: 1,
        resetAt: sql`now() + make_interval(mins => ${WINDOW_MINUTES})`,
      })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: {
          // Janela vencida: recomeça em 1. Senão, soma.
          count: sql`case when ${loginAttempts.resetAt} <= now() then 1 else ${loginAttempts.count} + 1 end`,
          resetAt: sql`case when ${loginAttempts.resetAt} <= now() then now() + make_interval(mins => ${WINDOW_MINUTES}) else ${loginAttempts.resetAt} end`,
        },
      });
  }
  // Faxina: remove contadores cuja janela já passou, para a tabela não crescer.
  await db.delete(loginAttempts).where(lt(loginAttempts.resetAt, sql`now() - interval '1 hour'`));
}

/** Login certo: zera só o contador da conta (o da origem continua valendo). */
export async function clearLoginFailures(username: string) {
  await db.delete(loginAttempts).where(inArray(loginAttempts.key, [userKey(username)]));
}
