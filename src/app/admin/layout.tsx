import type { Metadata } from "next";

/**
 * Общий макет админки.
 *
 * Единственная его задача — закрыть весь раздел от поисковиков. Это
 * третий из четырёх слоёв: остальные — правило в robots.txt, заголовок
 * X-Robots-Tag в proxy.ts и редирект неавторизованных на страницу входа.
 * Дублирование намеренное: любой слой можно случайно снять при правке.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
