import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { readSession } from "./session";

/**
 * Usuário logado, conferido no banco a cada requisição:
 *  - se for desativado, perde o acesso na hora;
 *  - se a senha foi trocada/redefinida depois que o cookie foi emitido
 *    (session_version diferente), o cookie antigo é recusado.
 */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!user || !user.active) return null;
  if (user.sessionVersion !== session.version) return null;
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/ponto");
  return user;
}

export async function requireEmployee() {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/admin");
  return user;
}
