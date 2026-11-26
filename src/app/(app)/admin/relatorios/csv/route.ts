import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { describePlace } from "@/lib/location";
import { PUNCH_ORDER, PUNCH_SHORT } from "@/lib/punches";
import { getMonthReport } from "@/lib/report";
import { dayBadges } from "@/lib/report-labels";
import { formatDateBR, formatDuration, formatTime, workDateOf } from "@/lib/time";

// Escapa para CSV e neutraliza fórmulas (=, +, -, @) caso o texto vá para o Excel.
function esc(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: NextRequest) {
  await requireAdmin();

  const f = req.nextUrl.searchParams.get("f");
  const mes = req.nextUrl.searchParams.get("mes");
  if (!f || !z.uuid().safeParse(f).success) {
    return new Response("Funcionário inválido.", { status: 400 });
  }
  const report = await getMonthReport(f, mes);
  if (!report) return new Response("Funcionário não encontrado.", { status: 404 });

  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const today = workDateOf(new Date());
  const { bank } = report;
  // Extra e débito em colunas separadas: um "+1h00" ou "-1h00" seria lido pelo Excel como fórmula.
  const extra = (min: number) => (min > 0 ? formatDuration(min) : "");
  const debit = (min: number) => (min < 0 ? formatDuration(-min) : "");
  const saldo = (min: number) =>
    min === 0 ? "0h00" : `${min > 0 ? "extra" : "débito"} ${formatDuration(Math.abs(min))}`;

  const lines: string[][] = [
    ["Funcionário", report.user.name],
    ["Período", report.month.key],
    [],
    [
      "Data",
      "Dia",
      ...PUNCH_ORDER.map((t) => PUNCH_SHORT[t]),
      "Total",
      ...(bank ? ["Previsto", "Hora extra", "Débito"] : []),
      "Observações",
    ],
  ];

  for (const r of report.rows) {
    const notes = [
      ...dayBadges(r, today).map((b) => b.text),
      // Os avisos de local já vêm acima; aqui entram as batidas confirmadas por GPS.
      ...PUNCH_ORDER.flatMap((t) => {
        const p = r.byType[t];
        return p?.locationCheck === "GPS"
          ? [`${PUNCH_SHORT[t]}: ${describePlace("GPS", p.distanceMeters)}`]
          : [];
      }),
      ...r.all
        .filter((p) => !p.voidedAt && p.source === "MANUAL")
        .map((p) => `${PUNCH_SHORT[p.type]} lançada manualmente${p.note ? `: ${p.note}` : ""}`),
    ];
    lines.push([
      formatDateBR(r.date),
      weekdays[r.weekday],
      ...PUNCH_ORDER.map((t) => (r.byType[t] ? formatTime(r.byType[t]!.at) : "")),
      r.hasPunches ? formatDuration(r.minutes) : "",
      ...(bank
        ? [
            r.expected === null ? "" : formatDuration(r.expected),
            extra(r.balance ?? 0),
            debit(r.balance ?? 0),
          ]
        : []),
      notes.join(" | "),
    ]);
  }
  lines.push([]);
  lines.push([
    "Total do mês",
    "",
    "",
    "",
    "",
    "",
    formatDuration(report.totals.minutes),
    ...(bank
      ? [
          formatDuration(bank.expectedMinutes),
          formatDuration(report.rows.reduce((s, r) => s + Math.max(0, r.balance ?? 0), 0)),
          formatDuration(report.rows.reduce((s, r) => s + Math.max(0, -(r.balance ?? 0)), 0)),
        ]
      : []),
    `${report.totals.daysWorked} dia(s) trabalhado(s)`,
  ]);
  if (bank) {
    lines.push([]);
    lines.push(["Banco de horas desde", formatDateBR(bank.since)]);
    lines.push(["Saldo anterior", saldo(bank.previous)]);
    lines.push(["Saldo do mês", saldo(bank.month)]);
    lines.push(["Saldo acumulado", saldo(bank.accumulated)]);
    lines.push(["Horas pendentes para pagar", formatDuration(Math.max(0, -bank.accumulated))]);
    lines.push(["Faltas no mês", String(bank.absences)]);
    lines.push(["Dias incompletos (fora do saldo)", String(bank.pendingMonth + bank.pendingPrevious)]);
  }

  // BOM + ponto e vírgula: o Excel em português abre direito, com acentos.
  const csv = "﻿" + lines.map((l) => l.map(esc).join(";")).join("\r\n");
  const filename = `ponto-${report.user.username}-${report.month.key}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
