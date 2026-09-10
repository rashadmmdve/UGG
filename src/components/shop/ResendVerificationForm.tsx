"use client";

import { useActionState } from "react";

import { AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { resendVerificationAction, type FormState } from "@/server/auth/actions";

const EMPTY: FormState = {};

/**
 * «Отправить письмо ещё раз». Почта либо известна со страницы
 * регистрации и передаётся скрытым полем, либо спрашивается.
 */
export function ResendVerificationForm({ email, askEmail }: { email: string; askEmail: boolean }) {
  const [state, action] = useActionState(resendVerificationAction, EMPTY);

  return (
    <form action={action} noValidate className="flex flex-col gap-3 text-left">
      <FormMessage error={state.error} success={state.success} />
      {askEmail ? (
        <AField id="resend-email" name="email" type="email" label="Почта" autoComplete="email" defaultValue={email} error={state.fieldErrors?.email} />
      ) : (
        <input type="hidden" name="email" value={email} />
      )}
      <SubmitButton variant="outline" className="h-11">Отправить письмо ещё раз</SubmitButton>
    </form>
  );
}
