// Avisos de cada dia, usados pela tabela da tela/impressão e pela planilha CSV.
import { describePlace } from "./location";
import { PUNCH_ORDER, PUNCH_SHORT } from "./punches";
import type { DayRow } from "./report";
import { DAY_OFF_LABEL } from "./schedule";
import { formatDuration } from "./time";

export type DayBadge = { text: string; tone: "warn" | "bad" | "info" };

export function dayBadges(row: DayRow, today: string): DayBadge[] {
  const badges: DayBadge[] = [];
  if (row.dayOff) {
    badges.push({ text: `${DAY_OFF_LABEL[row.dayOff.kind]}: ${row.dayOff.reason}`, tone: "info" });
  }
  // O dia de hoje pode estar em andamento; com atestado/abono não há o que corrigir.
  if (row.hasPunches && !row.complete && row.date !== today && row.dayOff?.kind !== "EXCUSED") {
    badges.push({ text: "Incompleto", tone: "warn" });
  }
  if (row.absent) badges.push({ text: "Falta", tone: "bad" });
  // Dia trabalhado que ficou abaixo da jornada (a falta do dia inteiro já tem o aviso acima).
  if (!row.absent && row.balance !== null && row.balance < 0) {
    badges.push({ text: `Horas pendentes: ${formatDuration(-row.balance)}`, tone: "bad" });
  }
  if (row.lateEntry) badges.push({ text: `Atraso na entrada: ${row.lateEntry} min`, tone: "warn" });
  if (row.lateLunch) {
    badges.push({ text: `Atraso na volta do almoço: ${row.lateLunch} min`, tone: "warn" });
  }
  if (row.outsideStoreHours) badges.push({ text: "Fora do horário da loja", tone: "warn" });
  for (const type of PUNCH_ORDER) {
    const punch = row.byType[type];
    const check = punch?.locationCheck;
    if (check === "OUTSIDE" || check === "UNCONFIRMED") {
      badges.push({
        text: `${PUNCH_SHORT[type]}: ${describePlace(check, punch!.distanceMeters)}`,
        tone: check === "OUTSIDE" ? "bad" : "warn",
      });
    }
  }
  return badges;
}
