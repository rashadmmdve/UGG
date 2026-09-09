"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { ProductCard } from "@/components/shop/ProductCard";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import { cn, formatPrice, plural } from "@/lib/utils";
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
  priceMax: number | null;
  sort: Sort;
  page: number;
};

const DEFAULT_FILTERS: Filters = {
  colors: [],
  sizes: [],
  materials: [],
  priceMax: null,
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
    priceMax: params.get("price_max") ? Number(params.get("price_max")) : null,
    sort: (params.get("sort") as Sort) || "new",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

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
 * JavaScript увидел бы пустую категорию. Сервер всегда отдаёт полный
 * список, для поисковика канонический адрес — чистый, без параметров.
 */
export function CatalogGrid({
  products,
  colors,
}: {
  products: Product[];
  colors: Color[];
}) {
  const colorById = useMemo(() => new Map(colors.map((color) => [color.id, color])), [colors]);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    // Первый рендер в браузере совпадает с серверным (без фильтров), затем
    // применяем то, что есть в адресе. Через transition, чтобы не звать
    // setState синхронно в теле эффекта.
    if (!window.location.search) return;
    startTransition(() => setFilters(filtersFromUrl()));
  }, []);

  function update(patch: Partial<Filters>) {
    setFilters((current) => {
      const next = { ...current, ...patch, page: patch.page ?? 1 };
      // Адрес меняется без обращения к серверу и без записи в историю.
      const params = new URLSearchParams();
      next.colors.forEach((c) => params.append("color", c));
      next.sizes.forEach((s) => params.append("size", String(s)));
      next.materials.forEach((m) => params.append("material", m));
      if (next.priceMax) params.set("price_max", String(next.priceMax));
      if (next.sort !== "new") params.set("sort", next.sort);
      if (next.page > 1) params.set("page", String(next.page));
      const query = params.toString();
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
      return next;
    });
  }

  // Доступные значения фильтров — по товарам в наличии.
  const facets = useMemo(() => {
    const colorGroups = new Map<string, { title: string; count: number }>();
    const sizes = new Map<number, number>();
    const materials = new Map<string, number>();
    let maxPrice = 0;

    for (const product of products) {
      const available = product.variants.filter((v) => v.stock > 0);
      if (available.length === 0) continue;
      maxPrice = Math.max(maxPrice, product.price);
      const color = product.colorId ? colorById.get(product.colorId) : null;
      if (color) {
        const entry = colorGroups.get(color.slug) ?? { title: color.group, count: 0 };
        entry.count += 1;
        colorGroups.set(color.slug, entry);
      }
      for (const size of new Set(available.map((v) => v.sizeEu))) sizes.set(size, (sizes.get(size) ?? 0) + 1);
      for (const material of product.materials) materials.set(material, (materials.get(material) ?? 0) + 1);
    }

    return {
      colors: [...colorGroups.entries()].sort((a, b) => b[1].count - a[1].count),
      sizes: [...sizes.keys()].sort((a, b) => a - b),
      materials: [...materials.entries()].sort((a, b) => b[1] - a[1]),
      maxPrice,
    };
  }, [products, colorById]);

  const filtered = useMemo(() => {
    let list = products.filter((product) => {
      if (filters.colors.length) {
        const color = product.colorId ? colorById.get(product.colorId) : null;
        if (!color || !filters.colors.includes(color.slug)) return false;
      }
      if (filters.sizes.length) {
        if (!product.variants.some((v) => v.stock > 0 && filters.sizes.includes(v.sizeEu))) return false;
      }
      if (filters.materials.length) {
        if (!product.materials.some((m) => filters.materials.includes(m))) return false;
      }
      if (filters.priceMax && product.price > filters.priceMax) return false;
      return true;
    });

    // Распроданное — в конец, внутри групп по выбранной сортировке.
    const inStock = (p: Product) => p.variants.some((v) => v.stock > 0);
    list = [...list].sort((a, b) => {
      const stockDiff = Number(inStock(b)) - Number(inStock(a));
      if (stockDiff !== 0) return stockDiff;
      if (filters.sort === "price-asc") return a.price - b.price;
      if (filters.sort === "price-desc") return b.price - a.price;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }, [products, filters, colorById]);

  const pages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const page = Math.min(filters.page, pages);
  const visible = filtered.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  const activeCount = filters.colors.length + filters.sizes.length + filters.materials.length + (filters.priceMax ? 1 : 0);
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const priceSteps = facets.maxPrice
    ? [5000, 10000, 15000, 20000, 30000].filter((step) => step < facets.maxPrice)
    : [];

  const panel = (
    <div className="flex flex-col gap-6 text-sm">
      {facets.colors.length > 1 && (
        <fieldset>
          <legend className="label-caps mb-2">Цвет</legend>
          <ul className="space-y-1">
            {facets.colors.map(([slug, { title, count }]) => (
              <li key={slug}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={filters.colors.includes(slug)}
                    onChange={() => update({ colors: toggle(filters.colors, slug) })} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="flex-1">{title}</span>
                  <span className="text-xs text-muted">{count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {facets.sizes.length > 1 && (
        <fieldset>
          <legend className="label-caps mb-2">Размер EU</legend>
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((size) => {
              const active = filters.sizes.includes(size);
              return (
                <button key={size} type="button" aria-pressed={active}
                  onClick={() => update({ sizes: toggle(filters.sizes, size) })}
                  className={cn("min-w-10 rounded border px-2 py-1 text-sm transition-colors",
                    active ? "border-accent bg-accent text-white" : "border-line hover:border-accent")}>
                  {size}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {facets.materials.length > 1 && (
        <fieldset>
          <legend className="label-caps mb-2">Материал</legend>
          <ul className="space-y-1">
            {facets.materials.map(([material, count]) => (
              <li key={material}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={filters.materials.includes(material)}
                    onChange={() => update({ materials: toggle(filters.materials, material) })} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="flex-1">{MATERIAL_LABELS[material as Material] ?? material}</span>
                  <span className="text-xs text-muted">{count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {priceSteps.length > 0 && (
        <fieldset>
          <legend className="label-caps mb-2">Цена</legend>
          <ul className="space-y-1">
            {priceSteps.map((step) => (
              <li key={step}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="price" checked={filters.priceMax === step}
                    onChange={() => update({ priceMax: step })} className="accent-[var(--accent)]" />
                  до {formatPrice(step)}
                </label>
              </li>
            ))}
            <li>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="price" checked={filters.priceMax === null}
                  onChange={() => update({ priceMax: null })} className="accent-[var(--accent)]" />
                любая
              </label>
            </li>
          </ul>
        </fieldset>
      )}

      {activeCount > 0 && (
        <button type="button" onClick={() => update({ colors: [], sizes: [], materials: [], priceMax: null })}
          className="text-left text-sm text-accent hover:underline">
          Сбросить фильтры
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">{panel}</aside>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {filtered.length} {plural(filtered.length, ["модель", "модели", "моделей"])}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPanelOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-line px-3 text-sm lg:hidden">
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.6} />
              Фильтры{activeCount > 0 && ` · ${activeCount}`}
            </button>
            <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as Sort })}
              aria-label="Сортировка" className="h-9 rounded border border-line bg-bg px-2 text-sm">
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
              <li key={product.id}><ProductCard product={product} eager={page === 1 && index < 4} /></li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Страницы" className="mt-10 flex justify-center gap-1">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => update({ page: n })} aria-current={n === page ? "page" : undefined}
                className={cn("h-9 min-w-9 rounded border px-2 text-sm", n === page ? "border-accent bg-accent text-white" : "border-line hover:border-accent")}>
                {n}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Фильтры на мобильном — шторка */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Закрыть фильтры" onClick={() => setPanelOpen(false)} className="absolute inset-0 bg-fg/30" />
          <div className="absolute inset-y-0 left-0 w-80 max-w-full overflow-y-auto bg-bg p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-semibold">Фильтры</p>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Закрыть"><X className="h-5 w-5" /></button>
            </div>
            {panel}
            <button type="button" onClick={() => setPanelOpen(false)}
              className="mt-6 h-11 w-full rounded-md bg-accent text-sm font-semibold text-white">
              Показать {filtered.length}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
