"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Разделы админки. Порядок — по частоте использования: заказы и товары
 * открывают каждый день, настройки логистики — раз в год.
 */
const SECTIONS: { href: string; label: string; group?: string }[] = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/products", label: "Товары" },
  { href: "/admin/reviews", label: "Отзывы" },

  { href: "/admin/categories", label: "Категории", group: "Каталог" },
  { href: "/admin/model-lines", label: "Модельные линии", group: "Каталог" },
  { href: "/admin/colors", label: "Цвета", group: "Каталог" },
  { href: "/admin/size-charts", label: "Размерные сетки", group: "Каталог" },

  { href: "/admin/seo", label: "Посадочные страницы", group: "SEO" },
  { href: "/admin/seo/templates", label: "Шаблоны метатегов", group: "SEO" },
  { href: "/admin/seo/redirects", label: "Редиректы", group: "SEO" },
  { href: "/admin/articles", label: "Статьи", group: "SEO" },

  { href: "/admin/customers", label: "Клиенты", group: "Прочее" },
  { href: "/admin/promocodes", label: "Промокоды", group: "Прочее" },
  { href: "/admin/logistics", label: "Логистика", group: "Прочее" },
  { href: "/admin/content", label: "Тексты сайта", group: "Прочее" },
];

export function AdminNav() {
  const pathname = usePathname();

  /**
   * Пункт активен, если путь совпадает или лежит под ним. Исключение —
   * пункты, у которых есть «соседи» с более длинным префиксом: /admin/seo
   * не должен подсвечиваться на /admin/seo/templates.
   */
  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/admin") return false;
    const hasLongerSibling = SECTIONS.some(
      (s) => s.href !== href && s.href.startsWith(`${href}/`) && pathname.startsWith(s.href),
    );
    return !hasLongerSibling && pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="text-sm">
      <ul className="space-y-0.5">
        {SECTIONS.map((section, index) => {
          // Заголовок группы — перед первым пунктом группы: сравниваем с
          // предыдущим элементом списка, а не копим состояние при рендере.
          const showGroup =
            section.group && section.group !== SECTIONS[index - 1]?.group;

          return (
            <li key={section.href}>
              {showGroup && (
                <p className="label-caps mt-5 mb-1.5 px-3">{section.group}</p>
              )}
              <Link
                href={section.href}
                className={cn(
                  "block rounded px-3 py-1.5 transition-colors",
                  isActive(section.href)
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-fg hover:bg-elevated",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
