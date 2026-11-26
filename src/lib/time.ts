// Todas as datas "de parede" (dia, hora) do sistema são do fuso da loja.
export const TZ = "America/Sao_Paulo";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // en-CA formata como YYYY-MM-DD

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Dia de trabalho ("YYYY-MM-DD") de um instante, no fuso da loja. */
export function workDateOf(d: Date): string {
  return dateFmt.format(d);
}

/** "08:02" no fuso da loja. */
export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

/** Minuto absoluto (trunca os segundos), para as contas baterem com o que aparece na tela. */
export function minuteOf(d: Date): number {
  return Math.floor(d.getTime() / 60000);
}

/** 462 -> "7h42" */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Saldo com sinal: 75 -> "+1h15", -30 -> "-0h30", 0 -> "0h00" */
export function formatBalance(totalMinutes: number): string {
  if (totalMinutes === 0) return "0h00";
  const sign = totalMinutes > 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(totalMinutes))}`;
}

/** true só para datas que existem no calendário, no formato "YYYY-MM-DD". */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "2026-11-30" + 1 -> "2026-12-01" */
export function addDays(dateStr: string, delta: number): string {
  const d = utcNoon(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-26" -> "26/11/2026" */
export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function utcNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** 0 = domingo ... 6 = sábado */
export function weekdayIndex(dateStr: string): number {
  return utcNoon(dateStr).getUTCDay();
}

/** "qui" */
export function weekdayShort(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" })
    .format(utcNoon(dateStr))
    .replace(".", "");
}

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Quinta-feira, 26 de novembro" */
export function longDateLabel(dateStr: string): string {
  return capFirst(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(utcNoon(dateStr)),
  );
}

export type MonthInfo = {
  key: string; // "2026-11"
  year: number;
  month: number; // 1-12
  first: string; // "2026-11-01"
  last: string; // "2026-11-30"
  days: string[]; // todos os dias do mês
};

/** Aceita "YYYY-MM"; qualquer outra coisa cai no mês atual. */
export function parseMonth(input?: string | null): MonthInfo {
  let key = input ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) key = workDateOf(new Date()).slice(0, 7);
  const [year, month] = key.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from(
    { length: count },
    (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`,
  );
  return { key, year, month, first: days[0], last: days[count - 1], days };
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Novembro de 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return capFirst(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, 1))),
  );
}

function tzOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - utcMs) / 60000;
}

/** Converte "2026-11-26" + "08:30" (hora da loja) no instante real (UTC). */
export function zonedToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess - tzOffsetMinutes(guess) * 60000;
  utc = guess - tzOffsetMinutes(utc) * 60000;
  return new Date(utc);
}
