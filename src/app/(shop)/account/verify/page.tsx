import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck, MailX } from "lucide-react";

import { ResendVerificationForm } from "@/components/shop/ResendVerificationForm";
import { getCurrentCustomer } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Подтверждение почты",
  robots: { index: false, follow: false },
};

/**
 * Две роли у одной страницы.
 *
 * После регистрации — «проверьте почту» с кнопкой отправить письмо ещё
 * раз. С параметром error — сюда же возвращает обработчик ссылки из
 * письма, если ссылка устарела или не подошла. Саму ссылку проверяет
 * /account/confirm: страница не может выставить куку входа.
 */
export default async function VerifyPage(props: PageProps<"/account/verify">) {
  const params = await props.searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const email = typeof params.email === "string" ? params.email : "";

  if (error) {
    return (
      <Shell icon={<MailX className="h-12 w-12 text-muted" strokeWidth={1.4} />} title="Ссылка не подошла">
        <p className="mt-3 max-w-md text-sm text-muted">
          {error === "expired"
            ? "Ссылка действовала сутки и уже устарела."
            : "Такой ссылки нет — возможно, она уже использована или скопирована не полностью."}{" "}
          Запросите новое письмо — укажите почту, на которую регистрировались.
        </p>
        <div className="mt-6 w-full max-w-sm">
          <ResendVerificationForm email={email} askEmail />
        </div>
      </Shell>
    );
  }

  // Уже вошедшему здесь делать нечего.
  if (await getCurrentCustomer()) redirect("/account");

  return (
    <Shell icon={<MailCheck className="h-12 w-12 text-success" strokeWidth={1.4} />} title="Проверьте почту">
      <p className="mt-3 max-w-md text-sm text-muted">
        {email ? (
          <>Мы отправили письмо на <span className="font-medium text-fg">{email}</span>. </>
        ) : (
          "Мы отправили вам письмо. "
        )}
        Откройте его и нажмите «Подтвердить почту» — после этого аккаунт заработает.
      </p>
      <p className="mt-2 max-w-md text-xs text-muted">
        Письма нет пару минут? Загляните в «Спам» или отправьте его ещё раз.
      </p>
      <div className="mt-6 w-full max-w-sm">
        <ResendVerificationForm email={email} askEmail={!email} />
      </div>
    </Shell>
  );
}

function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      {icon}
      <h1 className="heading-section mt-4">{title}</h1>
      {children}
      <Link href="/" className="mt-8 text-sm text-muted underline underline-offset-4 hover:text-accent">
        На главную
      </Link>
    </div>
  );
}
