"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form-message";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { validatePassword } from "@/lib/password";
import { clearLoginFailures, isLoginBlocked, registerLoginFailure } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/session";

// Usado quando o usuário não existe, para o tempo de resposta ser o mesmo.
const DUMMY_HASH = bcrypt.hashSync("senha-ficticia", 10);

// Tamanhos máximos: evitam gastar bcrypt com textos gigantes e encher o banco de chaves lixo.
const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Informe o usuário e a senha." };
  const { username, password } = parsed.data;

  // Na Vercel o x-forwarded-for é preenchido pela própria plataforma (não pelo cliente).
  // Em outro host, só confie nele se houver um proxy seu na frente que o sobrescreva.
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim().slice(0, 64) || "local";
  if (await isLoginBlocked(username, ip)) {
    return { error: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !passwordOk) {
    await registerLoginFailure(username, ip);
    return { error: "Usuário ou senha incorretos." };
  }

  await clearLoginFailures(username);
  await createSession(user.id, user.sessionVersion);
  redirect(user.role === "ADMIN" ? "/admin" : "/ponto");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "A senha atual está incorreta." };
  }
  const problem = validatePassword(next, user.username);
  if (problem) return { error: problem };
  if (next !== confirm) {
    return { error: "A confirmação não é igual à nova senha." };
  }

  // Sobe a versão da sessão: cookies antigos (outros aparelhos, ou de quem tivesse
  // roubado o cookie) deixam de valer.
  const [updated] = await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(next, 10),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, user.id))
    .returning({ sessionVersion: users.sessionVersion });

  // Quem trocou a senha continua logado neste aparelho, com um cookie novo.
  await createSession(user.id, updated.sessionVersion);
  return { success: "Senha alterada com sucesso. Os outros aparelhos foram desconectados." };
}
