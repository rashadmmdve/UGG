"use client";

import { useActionState } from "react";

import { AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { logoutCustomerAction, updateProfileAction, type FormState } from "@/server/auth/actions";
import type { PublicUser } from "@/lib/types";

export function ProfileForm({ user }: { user: PublicUser }) {
  // Идентификатор привязывается к действию заранее: сервер всё равно
  // проверит сессию, но форме не нужно носить его в скрытом поле.
  const bound = updateProfileAction.bind(null, user.id);
  const [state, action] = useActionState(bound, {} as FormState);

  return (
    <div className="max-w-md">
      <form action={action} noValidate className="flex flex-col gap-4">
        <FormMessage error={state.error} success={state.fieldErrors ? undefined : state.success} />
        <AField id="profile-email" label="Почта" value={user.email} disabled hint="Почта используется для входа и не меняется" />
        <AField id="profile-name" name="name" label="Имя" autoComplete="name" defaultValue={user.name} error={state.fieldErrors?.name} />
        <AField id="profile-phone" name="phone" type="tel" label="Телефон" autoComplete="tel" defaultValue={user.phone} error={state.fieldErrors?.phone} />
        <SubmitButton className="h-11 w-fit">Сохранить</SubmitButton>
      </form>

      <form action={logoutCustomerAction} className="mt-8 border-t border-line pt-6">
        <button type="submit" className="text-sm text-muted underline underline-offset-4 hover:text-fg">
          Выйти из аккаунта
        </button>
      </form>
    </div>
  );
}
