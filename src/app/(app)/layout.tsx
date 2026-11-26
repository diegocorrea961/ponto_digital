import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { NavLink } from "@/components/nav-link";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const storeName = process.env.STORE_NAME ?? "Controle de ponto";
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link
            href="/"
            className="text-base font-semibold text-slate-900 hover:text-emerald-800"
          >
            {storeName}
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Link href="/conta" className="hover:text-slate-900 hover:underline">
              {user.name}
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Sair
              </button>
            </form>
          </div>
          <nav className="flex w-full flex-wrap gap-1" aria-label="Principal">
            {isAdmin ? (
              <>
                <NavLink href="/admin" exact>
                  Painel
                </NavLink>
                <NavLink href="/admin/funcionarios">Funcionários</NavLink>
                <NavLink href="/admin/relatorios">Relatórios</NavLink>
              </>
            ) : (
              <>
                <NavLink href="/ponto" exact>
                  Bater ponto
                </NavLink>
                <NavLink href="/ponto/historico">Meu histórico</NavLink>
              </>
            )}
            <NavLink href="/conta">Minha conta</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
