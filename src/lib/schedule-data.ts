// Leitura das jornadas no banco (as regras ficam em ./schedule).
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { workSchedules } from "@/db/schema";

/** Jornadas ativas (não removidas) do funcionário, da mais antiga para a mais nova. */
export function getScheduleVersions(userId: string) {
  return db
    .select()
    .from(workSchedules)
    .where(and(eq(workSchedules.userId, userId), isNull(workSchedules.removedAt)))
    .orderBy(asc(workSchedules.validFrom), asc(workSchedules.createdAt));
}
