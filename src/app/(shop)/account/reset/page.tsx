import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/shop/PasswordResetForms";
import { lookupResetToken } from "@/server/auth/passwordReset";

export const metadata: Metadata = {
  title: "Новый пароль",
  robots: { index: false, follow: false },
};

/**
 * Страница из письма «восстановление пароля». Код проверяется дважды:
 * здесь — чтобы не показывать форму по мёртвой ссылке, и в действии —
 * потому что между показом и отправкой ссылка могла устареть.
 */
export default async function ResetPasswordPage(props: PageProps<"/account/reset">) {
  const params = await props.searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const lookup = lookupResetToken(token);

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-sm">
        {lookup.ok ? (
          <>
            <h1 className="heading-section">Новый пароль</h1>
            <p className="mt-1 text-sm text-muted">Для аккаунта {lookup.user.email}.</p>
            <div className="mt-6"><ResetPasswordForm token={token} /></div>
          </>
        ) : (
          <>
            <h1 className="heading-section">Ссылка не подошла</h1>
            <p className="mt-1 text-sm text-muted">
              {lookup.reason === "expired"
                ? "Ссылка действовала час и уже устарела."
                : "Такой ссылки нет — возможно, она уже использована или скопирована не полностью."}
            </p>
            <Link href="/account/forgot" className="mt-6 inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
              Запросить новую ссылку
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
