import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { cardClass } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { EditEmployeeForm, ResetPasswordForm } from "../../employee-forms";

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
      <div className={cardClass}>
        <h2 className="mb-4 font-semibold">Redefinir senha</h2>
        <ResetPasswordForm id={employee.id} />
      </div>
    </div>
  );
}
