// Limite simples de tentativas de login, em memória.
// Suficiente para uma loja pequena; em várias instâncias cada uma conta separado.
const attempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;

export function isBlocked(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
