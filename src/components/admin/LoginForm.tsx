"use client";

import { useActionState } from "react";

import { AField, ACheckbox, FormMessage, SubmitButton } from "@/components/admin/ui";
import { loginAdminAction, type FormState } from "@/server/auth/actions";

const INITIAL: FormState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginAdminAction, INITIAL);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage error={state.error} />

      <AField
        id="email"
        name="email"
        type="email"
        label="Почта"
        autoComplete="username"
        required
        error={state.fieldErrors?.email}
      />

      <AField
        id="password"
        name="password"
        type="password"
        label="Пароль"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />

      <ACheckbox id="remember" name="remember" label="Запомнить меня" />

      <SubmitButton className="w-full">Войти</SubmitButton>
    </form>
  );
}
