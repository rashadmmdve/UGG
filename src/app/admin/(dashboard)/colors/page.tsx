import Link from "next/link";

import { getColors } from "@/server/repositories/catalog";

export default function AdminColorsPage() {
  const colors = getColors();

  // Группировка по фильтру: видно, какие оттенки схлопываются в один цвет.
  const groups = new Map<string, typeof colors>();
  for (const color of colors) {
    const list = groups.get(color.group) ?? [];
    list.push(color);
    groups.set(color.group, list);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Цвета <span className="text-base font-normal text-muted">{colors.length} оттенков, {groups.size} групп</span>
        </h1>
        <Link
          href="/admin/colors/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новый цвет
        </Link>
      </div>

      <p className="mt-2 text-sm text-muted">
        Оттенки одной группы делят общую посадочную страницу: Black, Onyx и Metallic Black — это один адрес «чёрные».
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...groups.entries()].map(([group, items]) => (
          <section key={group} className="rounded-lg border border-line bg-bg p-4">
            <h2 className="flex items-baseline justify-between font-semibold">
              {group}
              <span className="text-xs font-normal text-muted">/{items[0].slug}</span>
            </h2>
            <ul className="mt-3 space-y-1.5">
              {items.map((color) => (
                <li key={color.id}>
                  <Link
                    href={`/admin/colors/${color.id}`}
                    className="flex items-center gap-3 text-sm hover:text-accent"
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-full border border-line"
                      style={{ backgroundColor: color.hex }}
                      aria-hidden
                    />
                    {color.title}
                    <span className="ml-auto text-xs text-muted">{color.hex}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
