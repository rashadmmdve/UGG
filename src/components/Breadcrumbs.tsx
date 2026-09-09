import Link from "next/link";

import type { Crumb } from "@/server/seo/breadcrumbs";

/**
 * Видимые хлебные крошки.
 *
 * Данные те же, что уходят в разметку BreadcrumbList: расхождение между
 * видимым путём и размеченным поисковики считают попыткой обмана.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden className="text-line-strong">
                /
              </span>
            )}
            {item.url ? (
              <Link href={item.url} className="hover:text-accent">
                {item.title}
              </Link>
            ) : (
              <span className="text-fg">{item.title}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
