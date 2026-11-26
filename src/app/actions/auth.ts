"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form-message";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { clearFailures, isBlocked, registerFailure } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/session";

// Usado quando o usuário não existe, para o tempo de resposta ser o mesmo.
const DUMMY_HASH = bcrypt.hashSync("senha-ficticia", 10);

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
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

  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "local";
  const key = `${username}|${ip}`;
  if (isBlocked(key)) {
    return { error: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !passwordOk) {
    registerFailure(key);
    return { error: "Usuário ou senha incorretos." };
  }

  clearFailures(key);
  await createSession(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : "/ponto");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const passwordSchema = z
  .string()
  .min(6, "A nova senha precisa ter pelo menos 6 caracteres.")
  .max(72, "A nova senha é longa demais (máximo 72 caracteres).");

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = passwordSchema.safeParse(formData.get("next"));
  const confirm = String(formData.get("confirm") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "A senha atual está incorreta." };
  }
  if (!next.success) return { error: next.error.issues[0].message };
  if (next.data !== confirm) {
    return { error: "A confirmação não é igual à nova senha." };
  }

  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next.data, 10) })
    .where(eq(users.id, user.id));
  return { success: "Senha alterada com sucesso." };
}
