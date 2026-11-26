"use server";

// Jornada de trabalho e abonos (só administrador).
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/form-message";
import { db } from "@/db";
import { dayOffKindEnum, dayOffs, users, workSchedules } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { parseScheduleForm } from "@/lib/schedule";
import { addDays, formatDateBR } from "@/lib/time";
import { validFromSchema, dateSchema } from "@/lib/validation";

const idSchema = z.string().uuid();
const MAX_PERIOD_DAYS = 366;

async function employeeExists(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "EMPLOYEE")))
    .limit(1);
  return Boolean(row);
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ponto", "layout");
}

// ---------- Jornada ----------

export async function setScheduleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = z
    .object({ userId: idSchema, validFrom: validFromSchema })
    .safeParse({ userId: formData.get("userId"), validFrom: formData.get("validFrom") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const schedule = parseScheduleForm(formData);
  if ("error" in schedule) return { error: schedule.error };
  const { userId, validFrom } = parsed.data;
  if (!(await employeeExists(userId))) return { error: "Funcionário não encontrado." };

  await db.insert(workSchedules).values({
    userId,
    validFrom,
    days: schedule.week,
    createdById: admin.id,
  });

  refresh();
  return { success: `Jornada salva. Vale a partir de ${formatDateBR(validFrom)}.` };
}

export async function removeScheduleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const id = idSchema.safeParse(formData.get("scheduleId"));
  if (!id.success) return { error: "Jornada inválida." };

  const updated = await db
    .update(workSchedules)
    .set({ removedAt: new Date(), removedById: admin.id })
    .where(and(eq(workSchedules.id, id.data), isNull(workSchedules.removedAt)))
    .returning({ id: workSchedules.id });
  if (updated.length === 0) return { error: "Jornada não encontrada (talvez já removida)." };

  refresh();
  return { success: "Jornada removida." };
}

// ---------- Abonos (feriado, folga, atestado, férias) ----------

export async function addDayOffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = z
    .object({
      userId: idSchema,
      startDate: dateSchema,
      // Em branco = um dia só.
      endDate: z.union([z.literal(""), dateSchema]),
      kind: z.enum(dayOffKindEnum.enumValues, { message: "Escolha o tipo do abono." }),
      reason: z
        .string()
        .trim()
        .min(3, "Escreva o motivo do abono (mínimo 3 letras).")
        .max(200, "Motivo longo demais (máximo 200 caracteres)."),
    })
    .safeParse({
      userId: formData.get("userId"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate") ?? "",
      kind: formData.get("kind"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, startDate, kind, reason } = parsed.data;
  const endDate = parsed.data.endDate || startDate;

  if (endDate < startDate) return { error: "A data final não pode ser antes da inicial." };
  if (endDate > addDays(startDate, MAX_PERIOD_DAYS - 1)) {
    return { error: "O período do abono pode ter no máximo um ano." };
  }
  if (!(await employeeExists(userId))) return { error: "Funcionário não encontrado." };

  const [overlap] = await db
    .select()
    .from(dayOffs)
    .where(
      and(
        eq(dayOffs.userId, userId),
        isNull(dayOffs.removedAt),
        lte(dayOffs.startDate, endDate),
        gte(dayOffs.endDate, startDate),
      ),
    )
    .limit(1);
  if (overlap) {
    return {
      error: `Já existe um abono entre ${formatDateBR(overlap.startDate)} e ${formatDateBR(overlap.endDate)}. Remova-o antes de lançar outro.`,
    };
  }

  await db.insert(dayOffs).values({
    userId,
    startDate,
    endDate,
    kind,
    reason,
    createdById: admin.id,
  });

  refresh();
  return { success: "Abono lançado." };
}

export async function removeDayOffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const id = idSchema.safeParse(formData.get("dayOffId"));
  if (!id.success) return { error: "Abono inválido." };

  const updated = await db
    .update(dayOffs)
    .set({ removedAt: new Date(), removedById: admin.id })
    .where(and(eq(dayOffs.id, id.data), isNull(dayOffs.removedAt)))
    .returning({ id: dayOffs.id });
  if (updated.length === 0) return { error: "Abono não encontrado (talvez já removido)." };

  refresh();
  return { success: "Abono removido." };
}
