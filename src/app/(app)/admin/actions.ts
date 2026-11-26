"use server";

import bcrypt from "bcryptjs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/form-message";
import { db } from "@/db";
import { punches, users, type PunchType } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db-errors";
import { PUNCH_LABEL, PUNCH_ORDER, isPunchType } from "@/lib/punches";
import { minuteOf, zonedToUtc } from "@/lib/time";

const nameSchema = z.string().trim().min(2, "Informe o nome.").max(80, "Nome longo demais.");

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,30}$/,
    "Usuário: de 3 a 30 caracteres, só letras minúsculas sem acento, números, ponto, hífen ou sublinhado (sem espaços).",
  );

const passwordSchema = z
  .string()
  .min(6, "A senha precisa ter pelo menos 6 caracteres.")
  .max(72, "A senha é longa demais (máximo 72 caracteres).");

const idSchema = z.string().uuid();

// ---------- Funcionários ----------

export async function createEmployeeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = z
    .object({
      name: nameSchema,
      username: usernameSchema,
      password: passwordSchema,
    })
    .safeParse({
      name: formData.get("name"),
      username: formData.get("username"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await db.insert(users).values({
      name: parsed.data.name,
      username: parsed.data.username,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "EMPLOYEE",
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { error: "Já existe alguém com esse usuário. Escolha outro." };
    }
    throw e;
  }

  revalidatePath("/admin", "layout");
  redirect("/admin/funcionarios?ok=criado");
}

export async function updateEmployeeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = z
    .object({ id: idSchema, name: nameSchema, username: usernameSchema })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      username: formData.get("username"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const active = formData.get("active") === "on";

  try {
    const updated = await db
      .update(users)
      .set({ name: parsed.data.name, username: parsed.data.username, active })
      .where(and(eq(users.id, parsed.data.id), eq(users.role, "EMPLOYEE")))
      .returning({ id: users.id });
    if (updated.length === 0) return { error: "Funcionário não encontrado." };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { error: "Já existe alguém com esse usuário. Escolha outro." };
    }
    throw e;
  }

  revalidatePath("/admin", "layout");
  return { success: "Dados salvos." };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = z
    .object({ id: idSchema, password: passwordSchema })
    .safeParse({ id: formData.get("id"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const updated = await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.password, 10) })
    .where(and(eq(users.id, parsed.data.id), eq(users.role, "EMPLOYEE")))
    .returning({ id: users.id });
  if (updated.length === 0) return { error: "Funcionário não encontrado." };

  return { success: "Senha redefinida. Avise o funcionário da nova senha." };
}

// ---------- Ajustes de batidas ----------

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const reasonSchema = z
  .string()
  .trim()
  .min(3, "Escreva o motivo do ajuste (mínimo 3 letras).")
  .max(200, "Motivo longo demais (máximo 200 caracteres).");

export async function addManualPunchAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const type = formData.get("type");
  const parsed = z
    .object({
      userId: idSchema,
      workDate: dateSchema,
      time: timeSchema,
      note: reasonSchema,
    })
    .safeParse({
      userId: formData.get("userId"),
      workDate: formData.get("workDate"),
      time: formData.get("time"),
      note: formData.get("note"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isPunchType(type)) return { error: "Escolha o tipo da batida." };
  const { userId, workDate, time, note } = parsed.data;

  const at = zonedToUtc(workDate, time);
  if (at.getTime() > Date.now()) {
    return { error: "Não é possível lançar uma batida no futuro." };
  }

  const [employee] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "EMPLOYEE")))
    .limit(1);
  if (!employee) return { error: "Funcionário não encontrado." };

  const active = await db
    .select()
    .from(punches)
    .where(
      and(
        eq(punches.userId, userId),
        eq(punches.workDate, workDate),
        isNull(punches.voidedAt),
      ),
    )
    .orderBy(asc(punches.at));

  if (active.some((p) => p.type === type)) {
    return {
      error: `Já existe "${PUNCH_LABEL[type]}" nesse dia. Anule a batida atual antes de lançar outra.`,
    };
  }

  // A ordem do dia precisa continuar fazendo sentido (entrada < almoço < volta < saída).
  const times = new Map<PunchType, number>(
    active.map((p) => [p.type, minuteOf(p.at)]),
  );
  times.set(type, minuteOf(at));
  const ordered = PUNCH_ORDER.filter((t) => times.has(t)).map((t) => times.get(t)!);
  if (ordered.some((m, i) => i > 0 && m <= ordered[i - 1])) {
    return {
      error:
        "Esse horário não combina com as outras batidas do dia (a ordem é: entrada, saída para o almoço, volta do almoço, saída).",
    };
  }

  try {
    await db.insert(punches).values({
      userId,
      type,
      at,
      workDate,
      source: "MANUAL",
      note,
      createdById: admin.id,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { error: "Essa batida acabou de ser registrada. Atualize a página." };
    }
    throw e;
  }

  revalidatePath("/admin", "layout");
  return { success: "Batida lançada." };
}

export async function voidPunchAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = z
    .object({ punchId: idSchema, reason: reasonSchema })
    .safeParse({
      punchId: formData.get("punchId"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const updated = await db
    .update(punches)
    .set({
      voidedAt: new Date(),
      voidReason: parsed.data.reason,
      voidedById: admin.id,
    })
    .where(and(eq(punches.id, parsed.data.punchId), isNull(punches.voidedAt)))
    .returning({ id: punches.id });
  if (updated.length === 0) return { error: "Batida não encontrada (talvez já anulada)." };

  revalidatePath("/admin", "layout");
  return { success: "Batida anulada." };
}
