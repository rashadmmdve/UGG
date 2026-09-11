"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { acceptCookiesAction, declineCookiesAction } from "@/server/consent/actions";
import type { Consent } from "@/lib/consent";

/**
 * Вопрос о cookies.
 *
 * Пока ответа нет — полоса внизу экрана, сайт при этом работает как
 * обычно: поисковики и первый визит не должны упираться в стену.
 * После отказа полоса остаётся, но говорит уже другое: сайт в
 * ограниченном режиме, и из него можно выйти, передумав.
 *
 * Обе кнопки — формы с серверными действиями, а не JS-обработчики:
 * кука httpOnly, из браузера её не выставить, и без JS всё тоже
 * работает.
 */
export function CookieConsent({ consent }: { consent: Consent | null }) {
  if (consent === "accepted") return null;

  return (
    <div
      role="region"
      aria-label="Использование cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-sm"
    >
      <div className="container-page flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        {consent === "declined" ? (
          <>
            <p className="text-sm text-fg">
              Вы отклонили cookies — сайт работает в ограниченном режиме: открыта
              только главная страница. Передумали?
            </p>
            <form action={acceptCookiesAction} className="shrink-0">
              <Button>Принять cookies</Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-fg">
              Сайт использует cookies: без них не запомнить корзину, вход в кабинет и
              ваши настройки. Подробнее — в{" "}
              <Link
                href="/politika-konfidentsialnosti"
                className="underline underline-offset-4 hover:text-accent"
              >
                политике конфиденциальности
              </Link>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <form action={declineCookiesAction}>
                <Button variant="outline">Отклонить</Button>
              </form>
              <form action={acceptCookiesAction}>
                <Button>Принять</Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "outline";
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-fg text-bg hover:opacity-90"
      : "border border-line text-fg hover:border-fg";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-10 items-center justify-center rounded px-5 text-sm font-medium transition disabled:opacity-60 ${styles}`}
    >
      {children}
    </button>
  );
}
