import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { cardClass } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { describeWeek, versionFor } from "@/lib/schedule";
import { getScheduleVersions } from "@/lib/schedule-data";
import { formatDateBR, workDateOf } from "@/lib/time";
import { EditEmployeeForm, ResetPasswordForm } from "../../employee-forms";
import { ScheduleHistory, SetScheduleForm } from "../../schedule-forms";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [employee] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      active: users.active,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "EMPLOYEE")))
    .limit(1);
  if (!employee) notFound();

  const today = workDateOf(new Date());
  const versions = await getScheduleVersions(employee.id);
  const current = versionFor(versions, today);
  // O formulário já vem preenchido com a jornada de hoje (ou a próxima agendada).
  const initial = (current ?? versions.at(-1))?.days;
  const history = [...versions].reverse().map((v) => ({
    id: v.id,
    validFrom: formatDateBR(v.validFrom),
    current: v.id === current?.id,
    lines: describeWeek(v.days),
  }));

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <Link href="/admin/funcionarios" className="text-sm text-emerald-800 hover:underline">
          ← Funcionários
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{employee.name}</h1>
        <Link
          href={`/admin/relatorios?f=${employee.id}`}
          className="text-sm text-emerald-800 hover:underline"
        >
          Ver relatório de ponto
        </Link>
      </div>
      <div className={cardClass}>
        <h2 className="mb-4 font-semibold">Dados</h2>
        <EditEmployeeForm employee={employee} />
      </div>
      <div className={`${cardClass} space-y-4`}>
        <h2 className="font-semibold">Jornada e banco de horas</h2>
        <ScheduleHistory items={history} />
        <details open={versions.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
            {versions.length === 0 ? "Cadastrar jornada" : "Alterar jornada"}
          </summary>
          <div className="mt-4">
            {/* key: depois de salvar, o formulário recomeça com a jornada nova */}
            <SetScheduleForm
              key={versions.map((v) => v.id).join()}
              userId={employee.id}
              initial={initial}
              today={today}
            />
          </div>
        </details>
      </div>
      <div className={cardClass}>
        <h2 className="mb-4 font-semibold">Redefinir senha</h2>
        <ResetPasswordForm id={employee.id} />
      </div>
    </div>
  );
}
