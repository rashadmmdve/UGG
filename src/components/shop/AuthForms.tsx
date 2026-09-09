"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ACheckbox, AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { loginCustomerAction, registerAction, type FormState } from "@/server/auth/actions";

const EMPTY: FormState = {};

export function LoginForm() {
  const [state, action] = useActionState(loginCustomerAction, EMPTY);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage error={state.error} />
      <AField id="login-email" name="email" type="email" label="Почта" autoComplete="email" error={state.fieldErrors?.email} />
      <AField id="login-password" name="password" type="password" label="Пароль" autoComplete="current-password" error={state.fieldErrors?.password} />
      <ACheckbox id="login-remember" name="remember" label="Запомнить меня" />
      <SubmitButton className="h-11">Войти</SubmitButton>
      <p className="text-sm text-muted">
        Нет аккаунта?{" "}
        <Link href="/account/register" className="text-accent underline underline-offset-4">Зарегистрироваться</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, EMPTY);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage error={state.error} />
      <AField id="reg-name" name="name" label="Имя" autoComplete="name" error={state.fieldErrors?.name} />
      <AField id="reg-email" name="email" type="email" label="Почта" autoComplete="email" error={state.fieldErrors?.email} />
      <AField id="reg-phone" name="phone" type="tel" label="Телефон" autoComplete="tel" placeholder="+7 900 000-00-00" error={state.fieldErrors?.phone} />
      <AField id="reg-password" name="password" type="password" label="Пароль" autoComplete="new-password" hint="Минимум 8 символов" error={state.fieldErrors?.password} />
      <SubmitButton className="h-11">Создать аккаунт</SubmitButton>
      <p className="text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/account/login" className="text-accent underline underline-offset-4">Войти</Link>
      </p>
    </form>
  );
}
