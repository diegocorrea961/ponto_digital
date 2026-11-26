import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/ponto");

  const storeName = process.env.STORE_NAME ?? "Controle de ponto";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Controle de ponto
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{storeName}</h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
    </main>
  );
}
