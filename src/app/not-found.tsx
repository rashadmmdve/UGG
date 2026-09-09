import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: false },
};

/**
 * Страница 404. Лежит в корне, вне группы витрины, поэтому шапки у неё
 * нет — только логотип и пути назад. Отдаётся с настоящим кодом 404.
 */
export default function NotFound() {
  return (
    <main className="container-page flex min-h-screen flex-col items-center justify-center py-20 text-center">
      <Logo width={140} eager />
      <p className="mt-10 text-6xl font-bold text-line-strong">404</p>
      <h1 className="mt-3 text-xl font-semibold">Такой страницы нет</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Возможно, товар сняли с продажи или адрес изменился. Посмотрите каталог —
        там точно есть что примерить.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/catalog" className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
          В каталог
        </Link>
        <Link href="/" className="inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-medium hover:border-accent">
          На главную
        </Link>
      </div>
    </main>
  );
}
