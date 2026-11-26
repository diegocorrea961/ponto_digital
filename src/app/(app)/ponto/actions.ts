"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { punches, type PunchType } from "@/db/schema";
import { requireEmployee } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db-errors";
import { nextPunchType, PUNCH_LABEL } from "@/lib/punches";
import { formatTime, workDateOf } from "@/lib/time";

export type PunchState = { ok: boolean; message: string } | undefined;

export async function punchAction(
  _prev: PunchState,
  formData: FormData,
): Promise<PunchState> {
  const user = await requireEmployee();

  // Quem manda é o servidor: a hora e o dia são os do servidor, nunca os do aparelho.
  const now = new Date();
  const workDate = workDateOf(now);

  const today = await db
    .select()
    .from(punches)
    .where(
      and(
        eq(punches.userId, user.id),
        eq(punches.workDate, workDate),
        isNull(punches.voidedAt),
      ),
    )
    .orderBy(asc(punches.at));

  const next = nextPunchType(today);
  if (!next) {
    revalidatePath("/ponto");
    return { ok: false, message: "Você já registrou as 4 batidas de hoje." };
  }

  // A tela diz qual batida estava mostrando; se não for a esperada (outra aba,
  // duplo toque), não registra nada para não gravar a batida errada.
  const expected = formData.get("expected") as PunchType | null;
  if (expected !== next) {
    revalidatePath("/ponto");
    return {
      ok: false,
      message:
        "A tela estava desatualizada. Confira os registros de hoje e, se precisar, toque de novo.",
    };
  }

  try {
    await db.insert(punches).values({
      userId: user.id,
      type: next,
      at: now,
      workDate,
      source: "CLOCK",
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      revalidatePath("/ponto");
      return { ok: false, message: "Esse registro já tinha sido feito." };
    }
    throw e;
  }

  revalidatePath("/ponto");
  return {
    ok: true,
    message: `${PUNCH_LABEL[next]} registrada às ${formatTime(now)}.`,
  };
}
