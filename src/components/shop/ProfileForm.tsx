"use client";

import { useActionState } from "react";

import { AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { useStickyAction } from "@/lib/hooks/useStickyAction";
import {
  changePasswordAction,
  logoutAction,
  updateProfileAction,
  type FormState,
} from "@/server/auth/actions";
import type { PublicUser } from "@/lib/types";

export function ProfileForm({ user }: { user: PublicUser }) {
  // Идентификатор привязывается к действию заранее: сервер всё равно
  // проверит сессию, но форме не нужно носить его в скрытом поле.
  const bound = updateProfileAction.bind(null, user.id);
  const { state, action, values } = useStickyAction(bound, {} as FormState);

  return (
    <div className="max-w-md">
      <form action={action} noValidate className="flex flex-col gap-4">
        <FormMessage error={state.error} success={state.fieldErrors ? undefined : state.success} />
        <AField id="profile-email" label="Почта" value={user.email} disabled hint="Почта используется для входа и не меняется" />
        <AField id="profile-name" name="name" label="Имя" autoComplete="name" defaultValue={values.name ?? user.name} error={state.fieldErrors?.name} />
        <AField id="profile-phone" name="phone" type="tel" label="Телефон" autoComplete="tel" defaultValue={values.phone ?? user.phone} error={state.fieldErrors?.phone} />
        <SubmitButton className="h-11 w-fit">Сохранить</SubmitButton>
      </form>

      <PasswordForm />

      <form action={logoutAction} className="mt-8 border-t border-line pt-6">
        <button type="submit" className="text-sm text-muted underline underline-offset-4 hover:text-fg">
          Выйти из аккаунта
        </button>
      </form>
    </div>
  );
}

/**
 * Смена пароля — отдельная форма с отдельным состоянием: ошибка в
 * пароле не должна подсвечивать поля профиля, и наоборот. После удачной
 * смены поля очищаются ключом на форме.
 */
function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {} as FormState);

  return (
    <form
      key={state.success ?? "form"}
      action={action}
      noValidate
      className="mt-8 flex flex-col gap-4 border-t border-line pt-6"
    >
      <h2 className="font-semibold">Смена пароля</h2>
      <FormMessage error={state.error} success={state.success} />
      <AField id="pw-current" name="current" type="password" label="Текущий пароль" autoComplete="current-password" error={state.fieldErrors?.current} />
      <AField id="pw-new" name="password" type="password" label="Новый пароль" autoComplete="new-password" hint="Минимум 8 символов" error={state.fieldErrors?.password} />
      <AField id="pw-confirm" name="confirm" type="password" label="Ещё раз" autoComplete="new-password" error={state.fieldErrors?.confirm} />
      <SubmitButton className="h-11 w-fit">Изменить пароль</SubmitButton>
    </form>
  );
}
