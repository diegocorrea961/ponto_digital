import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PUNCH_ORDER, PUNCH_SHORT } from "@/lib/punches";
import { getMonthReport } from "@/lib/report";
import { formatDateBR, formatDuration, formatTime } from "@/lib/time";

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
  const lines: string[][] = [
    ["Funcionário", report.user.name],
    ["Período", report.month.key],
    [],
    ["Data", "Dia", ...PUNCH_ORDER.map((t) => PUNCH_SHORT[t]), "Total", "Observações"],
  ];

  for (const r of report.rows) {
    const notes = r.all
      .filter((p) => !p.voidedAt && p.source === "MANUAL")
      .map((p) => `${PUNCH_SHORT[p.type]} lançada manualmente${p.note ? `: ${p.note}` : ""}`);
    lines.push([
      formatDateBR(r.date),
      weekdays[r.weekday],
      ...PUNCH_ORDER.map((t) => (r.byType[t] ? formatTime(r.byType[t]!.at) : "")),
      r.hasPunches ? formatDuration(r.minutes) : "",
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
    `${report.totals.daysWorked} dia(s) trabalhado(s)`,
  ]);

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
