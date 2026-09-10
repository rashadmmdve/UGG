import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/shop/PasswordResetForms";
import { getCurrentCustomer } from "@/server/auth/session";
import { isMailEnabled } from "@/server/mail/mailer";

export const metadata: Metadata = {
  title: "Восстановление пароля",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  if (await getCurrentCustomer()) redirect("/account");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-sm">
        <h1 className="heading-section">Забыли пароль?</h1>
        {isMailEnabled() ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Укажите почту, на которую регистрировались, — пришлём ссылку для нового пароля.
            </p>
            <div className="mt-6"><ForgotPasswordForm /></div>
          </>
        ) : (
          // Без почты ссылку отправить нечем — честно говорим, куда писать.
          <p className="mt-1 text-sm text-muted">
            Восстановление по почте временно недоступно. Напишите нам на{" "}
            <a href="mailto:info@uggrussia.shop" className="text-accent underline underline-offset-4">info@uggrussia.shop</a>
            {" "}— поможем вручную.
          </p>
        )}
      </div>
    </div>
  );
}
