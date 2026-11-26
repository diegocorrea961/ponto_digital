"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, labelClass } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/password";
import {
  createEmployeeAction,
  resetPasswordAction,
  updateEmployeeAction,
} from "./actions";

const usernameHint =
  "Letras minúsculas sem acento, números, ponto ou hífen. Ex.: maria";

export function CreateEmployeeForm() {
  const [state, action] = useActionState(createEmployeeAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>
          Nome completo
        </label>
        <input id="name" name="name" required minLength={2} maxLength={80} className={inputClass} />
      </div>
      <div>
        <label htmlFor="username" className={labelClass}>
          Usuário (para entrar no sistema)
        </label>
        <input
          id="username"
          name="username"
          required
          autoCapitalize="none"
          autoCorrect="off"
          pattern="[a-zA-Z0-9._\-]{3,30}"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500">{usernameHint}</p>
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Senha inicial
        </label>
        <input
          id="password"
          name="password"
          type="text"
          required
          minLength={PASSWORD_MIN}
          autoComplete="off"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500">
          Mínimo {PASSWORD_MIN} caracteres, sem ser uma senha óbvia (como 1234567890) nem conter o usuário.
          Passe para o funcionário; ele pode trocar depois em &quot;Minha conta&quot;.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Cadastrando...">Cadastrar funcionário</SubmitButton>
    </form>
  );
}

export function EditEmployeeForm({
  employee,
}: {
  employee: { id: string; name: string; username: string; active: boolean };
}) {
  const [state, action] = useActionState(updateEmployeeAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={employee.id} />
      <div>
        <label htmlFor="name" className={labelClass}>
          Nome completo
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={employee.name}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="username" className={labelClass}>
          Usuário
        </label>
        <input
          id="username"
          name="username"
          required
          autoCapitalize="none"
          autoCorrect="off"
          pattern="[a-zA-Z0-9._\-]{3,30}"
          defaultValue={employee.username}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500">{usernameHint}</p>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="active"
          defaultChecked={employee.active}
          className="mt-1 size-5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-800">Funcionário ativo</span>
          <span className="block text-xs text-slate-500">
            Desmarque quando ele sair da loja: não consegue mais entrar, mas o histórico de ponto continua nos relatórios.
          </span>
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="new-password" className={labelClass}>
          Nova senha
        </label>
        <input
          id="new-password"
          name="password"
          type="text"
          required
          minLength={PASSWORD_MIN}
          autoComplete="off"
          className={inputClass}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Redefinindo...">
        Redefinir senha
      </SubmitButton>
    </form>
  );
}
