"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, labelClass } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/password";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="current" className={labelClass}>
          Senha atual
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="next" className={labelClass}>
          Nova senha
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-500">
          Mínimo {PASSWORD_MIN} caracteres. Evite senhas óbvias e não use seu nome de usuário.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>
          Repita a nova senha
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
          className={inputClass}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Alterar senha</SubmitButton>
    </form>
  );
}
