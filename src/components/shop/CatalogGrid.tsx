"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { Minus, Plus, SlidersHorizontal, X } from "lucide-react";

import { ProductCard } from "@/components/shop/ProductCard";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { cn, plural } from "@/lib/utils";
import type { Color, Material, Product } from "@/lib/types";

const MATERIAL_LABELS: Record<Material, string> = {
  ovchina: "Овчина",
  zamsha: "Замша",
  kozha: "Кожа",
  vyazanyj: "Вязаные",
  tekstil: "Текстиль",
};

type Sort = "new" | "price-asc" | "price-desc";

type Filters = {
  colors: string[];
  sizes: number[];
  materials: string[];
  sort: Sort;
  page: number;
};

/**
 * Со скольких значений список приходит свёрнутым. Восемь строк — примерно
 * та высота, после которой блок начинает вытеснять соседние фильтры за
 * пределы экрана.
 */
const COLLAPSE_FROM = 8;

const DEFAULT_FILTERS: Filters = {
  colors: [],
  sizes: [],
  materials: [],
  sort: "new",
  page: 1,
};

/** Фильтры из адресной строки — читаются только в браузере, после гидрации. */
function filtersFromUrl(): Filters {
  const params = new URLSearchParams(window.location.search);

  return {
    colors: params.getAll("color"),
    sizes: params.getAll("size").map(Number).filter((n) => !Number.isNaN(n)),
    materials: params.getAll("material"),
    sort: (params.get("sort") as Sort) || "new",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

/** Пункт списка категорий в боковой панели. */
export type CategoryLink = {
  title: string;
  href: string;
  count: number;
  active: boolean;
};

/**
 * Сетка каталога с фильтрами.
 *
 * Фильтрация, сортировка и постраничная навигация — на клиенте. Серверная
 * страница категории не читает параметры адреса: иначе каждый её адрес
 * стал бы динамическим, а нам нужно, чтобы страница отдавалась из кэша.
 *
 * Параметры адреса читаются через window уже после гидрации, а не через
 * useSearchParams: тот заставил бы React отрисовать сетку только в
 * браузере, и в серверном HTML осталась бы заглушка — робот без
 * JavaScript увидел бы пустую категорию.
 */
export function CatalogGrid({
  products,
  colors,
  categories = [],
}: {
  products: Product[];
  colors: Color[];
  /**
   * Категории раздела. Стоят первым блоком панели рядом с цветом и
   * размером, но остаются ссылками: это переход на другую страницу,
   * а не фильтр внутри текущей выборки.
   */
  categories?: CategoryLink[];
}) {
  const colorById = useMemo(() => new Map(colors.map((color) => [color.id, color])), [colors]);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    // Первый рендер в браузере совпадает с серверным (без фильтров), затем
    // применяем то, что есть в адресе.
    if (!window.location.search) return;
    startTransition(() => setFilters(filtersFromUrl()));
  }, []);

  // Пока открыта шторка фильтров, страница под ней не прокручивается,
  // а Escape её закрывает — этого ждут от любой модальной панели.
  useEffect(() => {
    if (!panelOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  /**
   * Применить фильтр и отразить его в адресной строке.
   *
   * Новое состояние считается здесь, а не в функции-обновителе setState:
   * та обязана быть чистой, а запись в history — побочный эффект, из-за
   * которого React ругался на обновление роутера во время рендера.
   * Вызывается всё это из обработчиков событий, поэтому `filters` из
   * замыкания здесь актуальны.
   */
  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    setFilters(next);

    const params = new URLSearchParams();
    next.colors.forEach((c) => params.append("color", c));
    next.sizes.forEach((s) => params.append("size", String(s)));
    next.materials.forEach((m) => params.append("material", m));
    if (next.sort !== "new") params.set("sort", next.sort);
    if (next.page > 1) params.set("page", String(next.page));

    const query = params.toString();
    // Адрес меняется без обращения к серверу и без записи в историю.
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  // Доступные значения фильтров — по товарам в наличии.
  const facets = useMemo(() => {
    const colorGroups = new Map<string, { title: string; count: number }>();
    const sizes = new Map<number, number>();
    const materials = new Map<string, number>();

    for (const product of products) {
      const available = product.variants.filter((v) => v.stock > 0);
      if (available.length === 0) continue;

      const color = product.colorId ? colorById.get(product.colorId) : null;
      if (color) {
        const entry = colorGroups.get(color.slug) ?? { title: color.group, count: 0 };
        entry.count += 1;
        colorGroups.set(color.slug, entry);
      }
      for (const size of new Set(available.map((v) => v.sizeEu))) {
        sizes.set(size, (sizes.get(size) ?? 0) + 1);
      }
      for (const material of product.materials) {
        materials.set(material, (materials.get(material) ?? 0) + 1);
      }
    }

    return {
      colors: [...colorGroups.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title, "ru")),
      sizes: [...sizes.entries()].sort((a, b) => a[0] - b[0]),
      materials: [...materials.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [products, colorById]);

  const filtered = useMemo(() => {
    const list = products.filter((product) => {
      if (filters.colors.length) {
        const color = product.colorId ? colorById.get(product.colorId) : null;
        if (!color || !filters.colors.includes(color.slug)) return false;
      }
      if (filters.sizes.length) {
        if (!product.variants.some((v) => v.stock > 0 && filters.sizes.includes(v.sizeEu))) {
          return false;
        }
      }
      if (filters.materials.length) {
        if (!product.materials.some((m) => filters.materials.includes(m))) return false;
      }
      return true;
    });

    // Распроданное — в конец, внутри групп по выбранной сортировке.
    const inStock = (p: Product) => p.variants.some((v) => v.stock > 0);
    return [...list].sort((a, b) => {
      const stockDiff = Number(inStock(b)) - Number(inStock(a));
      if (stockDiff !== 0) return stockDiff;
      if (filters.sort === "price-asc") return a.price - b.price;
      if (filters.sort === "price-desc") return b.price - a.price;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [products, filters, colorById]);

  const pages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const page = Math.min(filters.page, pages);
  const visible = filtered.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  const activeCount =
    filters.colors.length +
    filters.sizes.length +
    filters.materials.length;

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const panel = (
    <div className="flex flex-col divide-y divide-line">
      {categories.length > 0 && (
        <FilterBlock title="Категории" defaultOpen={categories.length < COLLAPSE_FROM}>
          {categories.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              className={cn(
                "flex items-center gap-2 py-1.5 text-sm transition-colors hover:text-accent",
                category.active ? "font-semibold text-accent" : "text-fg",
              )}
              aria-current={category.active ? "page" : undefined}
            >
              <span className="flex-1">{category.title}</span>
              {category.count > 0 && (
                <span className="text-xs text-muted tabular-nums">{category.count}</span>
              )}
            </Link>
          ))}
        </FilterBlock>
      )}

      {facets.colors.length > 1 && (
        <FilterBlock title="Цвет" defaultOpen={facets.colors.length < COLLAPSE_FROM}>
          {facets.colors.map(([slug, { title, count }]) => (
            <CheckRow
              key={slug}
              label={title}
              count={count}
              checked={filters.colors.includes(slug)}
              onChange={() => update({ colors: toggle(filters.colors, slug) })}
            />
          ))}
        </FilterBlock>
      )}

      {facets.sizes.length > 1 && (
        <FilterBlock title="Размер" defaultOpen={facets.sizes.length < COLLAPSE_FROM}>
          {facets.sizes.map(([size, count]) => (
            <CheckRow
              key={size}
              label={String(size)}
              count={count}
              checked={filters.sizes.includes(size)}
              onChange={() => update({ sizes: toggle(filters.sizes, size) })}
            />
          ))}
        </FilterBlock>
      )}

      {facets.materials.length > 1 && (
        <FilterBlock title="Материал" defaultOpen={facets.materials.length < COLLAPSE_FROM}>
          {facets.materials.map(([material, count]) => (
            <CheckRow
              key={material}
              label={MATERIAL_LABELS[material as Material] ?? material}
              count={count}
              checked={filters.materials.includes(material)}
              onChange={() => update({ materials: toggle(filters.materials, material) })}
            />
          ))}
        </FilterBlock>
      )}


      {activeCount > 0 && (
        <div className="py-4">
          <button
            type="button"
            onClick={() =>
              update({ colors: [], sizes: [], materials: [] })
            }
            className="text-sm underline underline-offset-4 hover:text-muted"
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">{panel}</aside>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {filtered.length} {plural(filtered.length, ["модель", "модели", "моделей"])}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-line px-3 text-sm lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.6} />
              Фильтры{activeCount > 0 && ` · ${activeCount}`}
            </button>
            <select
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as Sort })}
              aria-label="Сортировка"
              className="h-9 rounded border border-line bg-bg px-2 text-sm"
            >
              <option value="new">Сначала новые</option>
              <option value="price-asc">Дешевле</option>
              <option value="price-desc">Дороже</option>
            </select>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 rounded-lg border border-line bg-sand p-6 text-sm text-muted">
            По выбранным фильтрам ничего нет. Попробуйте снять часть условий.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
            {visible.map((product, index) => (
              <li key={product.id}>
                <ProductCard product={product} eager={page === 1 && index < 4} />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Страницы" className="mt-10 flex justify-center gap-1">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => update({ page: n })}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  "h-9 min-w-9 rounded border px-2 text-sm",
                  n === page ? "border-fg bg-fg text-bg" : "border-line hover:border-fg",
                )}
              >
                {n}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/*
        Фильтры на мобильном — шторка.

        Разметка не размонтируется при закрытии: иначе панель появлялась бы
        рывком, без анимации выезда. Видимость и доступность выключаются
        через aria-hidden, inert и pointer-events.
      */}
      <div
        aria-hidden={!panelOpen}
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          !panelOpen && "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Закрыть фильтры"
          tabIndex={panelOpen ? undefined : -1}
          onClick={() => setPanelOpen(false)}
          className={cn(
            "absolute inset-0 bg-fg/30 transition-opacity duration-300",
            panelOpen ? "opacity-100" : "opacity-0",
          )}
        />

        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-80 max-w-full flex-col bg-bg transition-transform duration-300 ease-out",
            panelOpen ? "translate-x-0" : "-translate-x-full",
          )}
          inert={!panelOpen}
        >
          {/* Та же высота, что у шапки сайта: иначе линия под заголовком
              шторки не совпадает с линией под шапкой. */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
            <p className="font-semibold">Фильтры</p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Закрыть"
              className="-mr-2 flex h-10 w-10 items-center justify-center"
            >
              <X className="h-5 w-5" strokeWidth={1.6} />
            </button>
          </div>

          {/* Нижний отступ — чтобы последний фильтр не упирался в кнопку. */}
          <div className="flex-1 overflow-y-auto px-5 pb-4">{panel}</div>

          <div className="shrink-0 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="h-11 w-full rounded-md bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Показать {filtered.length}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Блок фильтра — сворачивающийся список.
 *
 * Значений бывает и пять, и полсотни. Длинные списки закрыты при открытии
 * страницы, иначе один цвет отодвигал бы цену на два экрана вниз.
 *
 * Раскрытие анимируется переходом grid-rows с 0fr на 1fr: это
 * единственный способ плавно показать блок неизвестной высоты, не измеряя
 * её в JavaScript.
 */
function FilterBlock({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** Длинные списки приходят сюда закрытыми. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="py-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
      >
        {title}
        {open ? (
          <Minus className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} />
        ) : (
          <Plus className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} />
        )}
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        {/* Свёрнутый список не должен ловить фокус с клавиатуры. */}
        <div className="overflow-hidden" inert={!open}>
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </section>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted tabular-nums">{count}</span>
    </label>
  );
}
