import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireAdmin();
  const { ok } = await searchParams;

  const employees = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      active: users.active,
    })
    .from(users)
    .where(eq(users.role, "EMPLOYEE"))
    .orderBy(asc(users.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Funcionários</h1>
        <Link href="/admin/funcionarios/novo" className={btnPrimary}>
          + Novo funcionário
        </Link>
      </div>

      {ok === "criado" && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Funcionário cadastrado. Passe o usuário e a senha para ele entrar.
        </p>
      )}

      {employees.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
          Nenhum funcionário cadastrado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {employees.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">
                  {e.name}
                  {!e.active && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                      Inativo
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500">Usuário: {e.username}</p>
              </div>
              <div className="flex gap-2 text-sm">
                <Link
                  href={`/admin/relatorios?f=${e.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Relatório
                </Link>
                <Link
                  href={`/admin/funcionarios/${e.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
