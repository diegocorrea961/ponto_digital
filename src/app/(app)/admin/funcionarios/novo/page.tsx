import Link from "next/link";
import { cardClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { workDateOf } from "@/lib/time";
import { CreateEmployeeForm } from "../../employee-forms";

export default async function NewEmployeePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <Link href="/admin/funcionarios" className="text-sm text-emerald-800 hover:underline">
          ← Funcionários
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Novo funcionário</h1>
      </div>
      <div className={cardClass}>
        <CreateEmployeeForm today={workDateOf(new Date())} />
      </div>
    </div>
  );
}
