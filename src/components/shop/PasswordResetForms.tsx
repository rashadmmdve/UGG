"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { useStickyAction } from "@/lib/hooks/useStickyAction";
import {
  requestPasswordResetAction,
  resetPasswordAction,
  type FormState,
} from "@/server/auth/actions";

const EMPTY: FormState = {};

/** «Забыли пароль?» — просим почту, отвечаем одинаково для любой. */
export function ForgotPasswordForm() {
  const { state, action, values } = useStickyAction(requestPasswordResetAction, EMPTY);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />
      {!state.success && (
        <>
          <AField id="forgot-email" name="email" type="email" label="Почта" autoComplete="email" defaultValue={values.email ?? ""} error={state.fieldErrors?.email} />
          <SubmitButton className="h-11">Отправить ссылку</SubmitButton>
        </>
      )}
      <p className="text-sm text-muted">
        Вспомнили?{" "}
        <Link href="/account/login" className="text-accent underline underline-offset-4">Войти</Link>
      </p>
    </form>
  );
}

/** Новый пароль по ссылке из письма. Код передаётся скрытым полем. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, EMPTY);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage error={state.error} />
      {state.action && (
        <Link href={state.action.href} className="-mt-2 text-sm text-accent underline underline-offset-4">
          {state.action.label}
        </Link>
      )}
      <input type="hidden" name="token" value={token} />
      <AField id="reset-password" name="password" type="password" label="Новый пароль" autoComplete="new-password" hint="Минимум 8 символов" error={state.fieldErrors?.password} />
      <AField id="reset-confirm" name="confirm" type="password" label="Ещё раз" autoComplete="new-password" error={state.fieldErrors?.confirm} />
      <SubmitButton className="h-11">Сохранить пароль</SubmitButton>
    </form>
  );
}
