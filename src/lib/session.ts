import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const COOKIE = "ponto_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 horas

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET precisa existir e ter pelo menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

/** `version` é o users.session_version atual: se ele subir no banco, este cookie deixa de valer. */
export async function createSession(userId: string, version: number) {
  const token = await new SignJWT({ ver: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Devolve o id e a versão da sessão, ou null se não houver sessão válida (assinatura/validade).
 * Cookies emitidos antes da existência da versão não têm o campo `ver` e contam como 0.
 */
export async function readSession(): Promise<{ id: string; version: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    const version = typeof payload.ver === "number" ? payload.ver : 0;
    return { id: payload.sub, version };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
