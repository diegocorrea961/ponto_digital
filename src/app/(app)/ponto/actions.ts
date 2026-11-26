"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { punches, type LocationCheck, type PunchType } from "@/db/schema";
import { requireEmployee } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/db-errors";
import { ATTACH_WINDOW_MINUTES, checkByGps, checkByNetwork, storeCoords } from "@/lib/location";
import { clientNetwork } from "@/lib/network";
import { nextPunchType, PUNCH_LABEL } from "@/lib/punches";
import { getStoreSettings } from "@/lib/store";
import { formatTime, workDateOf } from "@/lib/time";

export type PunchState =
  | {
      ok: boolean;
      message: string;
      /** Aviso sobre o local da batida (a batida foi gravada do mesmo jeito). */
      warning?: string;
      /** Id da batida que ainda precisa ser conferida pelo GPS. */
      locate?: string;
    }
  | undefined;

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

  // Local: primeiro pela rede. A batida é gravada em qualquer caso.
  const store = await getStoreSettings();
  const check = checkByNetwork(store, clientNetwork(await headers()));

  let punchId: string;
  try {
    const [created] = await db
      .insert(punches)
      .values({
        userId: user.id,
        type: next,
        at: now,
        workDate,
        source: "CLOCK",
        locationCheck: check,
      })
      .returning({ id: punches.id });
    punchId = created.id;
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
    ...(check === "UNCONFIRMED" && {
      warning: "Não foi possível confirmar que você está na loja. A administradora verá este aviso.",
      // Fora da rede: o aparelho tenta confirmar pelo GPS, se a loja tiver localização.
      locate: storeCoords(store) ? punchId : undefined,
    }),
  };
}

const readingSchema = z.object({
  punchId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10_000_000),
});

/**
 * Anexa o GPS a uma batida recém-gravada. Só vale para a própria batida, uma única vez e dentro
 * do prazo: assim ninguém bate o ponto em casa e "confirma" depois, já na loja.
 */
export async function confirmLocationAction(input: {
  punchId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
}): Promise<{ check: LocationCheck; distance: number } | null> {
  const user = await requireEmployee();
  const parsed = readingSchema.safeParse(input);
  if (!parsed.success) return null;

  const store = await getStoreSettings();
  const coords = storeCoords(store);
  if (!coords) return null;
  const result = checkByGps(coords, store.radiusMeters, parsed.data);

  const updated = await db
    .update(punches)
    .set({
      locationCheck: result.check,
      distanceMeters: result.distance,
      accuracyMeters: result.accuracy,
    })
    .where(
      and(
        eq(punches.id, parsed.data.punchId),
        eq(punches.userId, user.id),
        eq(punches.source, "CLOCK"),
        isNull(punches.voidedAt),
        eq(punches.locationCheck, "UNCONFIRMED"),
        isNull(punches.distanceMeters),
        sql`${punches.createdAt} > now() - make_interval(mins => ${ATTACH_WINDOW_MINUTES})`,
      ),
    )
    .returning({ id: punches.id });
  if (updated.length === 0) return null;

  revalidatePath("/ponto");
  return { check: result.check, distance: result.distance };
}
