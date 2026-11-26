import { cardClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Minha conta</h1>
      <div className={cardClass}>
        <p className="text-sm text-slate-500">Nome</p>
        <p className="font-medium">{user.name}</p>
        <p className="mt-3 text-sm text-slate-500">Usuário de acesso</p>
        <p className="font-medium">{user.username}</p>
      </div>
      <div className={cardClass}>
        <h2 className="mb-4 font-semibold">Alterar senha</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
