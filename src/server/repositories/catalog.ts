import "server-only";

import { cache } from "react";

import { getDb, transaction } from "@/server/db/connection";
import {
  mapCategory,
  mapColor,
  mapModelLine,
  mapProduct,
  mapSizeChart,
  type CategoryRow,
  type ColorRow,
  type ModelLineRow,
  type ProductRow,
  type SizeChartRow_,
  type VariantRow,
} from "@/server/db/mappers";
import type { Category, Color, ModelLine, Product, SizeChart } from "@/lib/types";

/**
 * Каталог: категории, модельные линии, цвета, размерные сетки и товары.
 *
 * Все чтения обёрнуты в `cache()` из React — это снимает повторные запросы
 * в пределах одного рендера: макет, хлебные крошки и сама страница часто
 * просят один и тот же справочник.
 */

// ─── Справочники ─────────────────────────────────────────────────────────────

export const getCategories = cache((): Category[] => {
  const rows = getDb()
    .prepare("SELECT * FROM categories ORDER BY sort_order, title")
    .all() as CategoryRow[];
  return rows.map(mapCategory);
});

export const getPublishedCategories = cache((): Category[] =>
  getCategories().filter((category) => category.isPublished),
);

export const getCategoriesBySection = cache((sectionSlug: string): Category[] =>
  getPublishedCategories().filter(
    (category) => category.sectionSlug === sectionSlug,
  ),
);

export const getCategoryBySlug = cache(
  (sectionSlug: string, slug: string): Category | null =>
    getCategories().find(
      (category) =>
        category.sectionSlug === sectionSlug && category.slug === slug,
    ) ?? null,
);

export const getCategoryById = cache((id: string): Category | null =>
  getCategories().find((category) => category.id === id) ?? null,
);

/**
 * Поиск категории по устаревшему адресу или синониму — для 301-редиректа.
 * Синонимы вроде «korotkie-uggi» не получают отдельную страницу: две
 * страницы под один запрос отбирали бы позиции друг у друга.
 */
export const findCategoryByAlias = cache(
  (sectionSlug: string, alias: string): Category | null =>
    getCategories().find(
      (category) =>
        category.sectionSlug === sectionSlug && category.aliases.includes(alias),
    ) ?? null,
);

export const getModelLines = cache((): ModelLine[] => {
  const rows = getDb()
    .prepare("SELECT * FROM model_lines ORDER BY sort_order, title")
    .all() as ModelLineRow[];
  return rows.map(mapModelLine);
});

export const getModelLineById = cache((id: string): ModelLine | null =>
  getModelLines().find((line) => line.id === id) ?? null,
);

export const getColors = cache((): Color[] => {
  const rows = getDb()
    .prepare('SELECT id, slug, title, "group", hex FROM colors ORDER BY title')
    .all() as ColorRow[];
  return rows.map(mapColor);
});

export const getColorById = cache((id: string): Color | null =>
  getColors().find((color) => color.id === id) ?? null,
);

export const getSizeCharts = cache((): SizeChart[] => {
  const rows = getDb()
    .prepare("SELECT * FROM size_charts ORDER BY title")
    .all() as SizeChartRow_[];
  return rows.map(mapSizeChart);
});

export const getSizeChartById = cache((id: string): SizeChart | null =>
  getSizeCharts().find((chart) => chart.id === id) ?? null,
);

// ─── Товары ──────────────────────────────────────────────────────────────────

/**
 * Догрузка вариантов и связей с категориями для пачки товаров.
 *
 * Отдельная функция именно потому, что делать это по одному товару нельзя:
 * на странице каталога с полусотней карточек получилось бы больше сотни
 * обращений к базе вместо двух.
 */
function hydrate(rows: ProductRow[]): Product[] {
  if (rows.length === 0) return [];

  const db = getDb();
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");

  const variantRows = db
    .prepare(
      `SELECT * FROM product_variants WHERE product_id IN (${placeholders})`,
    )
    .all(...ids) as VariantRow[];

  const linkRows = db
    .prepare(
      `SELECT product_id, category_id FROM product_categories
       WHERE product_id IN (${placeholders})`,
    )
    .all(...ids) as { product_id: string; category_id: string }[];

  const variantsByProduct = new Map<string, VariantRow[]>();
  for (const variant of variantRows) {
    const list = variantsByProduct.get(variant.product_id);
    if (list) list.push(variant);
    else variantsByProduct.set(variant.product_id, [variant]);
  }

  const categoriesByProduct = new Map<string, string[]>();
  for (const link of linkRows) {
    const list = categoriesByProduct.get(link.product_id);
    if (list) list.push(link.category_id);
    else categoriesByProduct.set(link.product_id, [link.category_id]);
  }

  return rows.map((row) =>
    mapProduct(
      row,
      variantsByProduct.get(row.id) ?? [],
      categoriesByProduct.get(row.id) ?? [],
    ),
  );
}

export const getProducts = cache((): Product[] => {
  const rows = getDb()
    .prepare("SELECT * FROM products ORDER BY created_at DESC")
    .all() as ProductRow[];
  return hydrate(rows);
});

export const getPublishedProducts = cache((): Product[] => {
  const rows = getDb()
    .prepare(
      "SELECT * FROM products WHERE is_published = 1 ORDER BY created_at DESC",
    )
    .all() as ProductRow[];
  return hydrate(rows);
});

export const getProductBySlug = cache((slug: string): Product | null => {
  const row = getDb()
    .prepare("SELECT * FROM products WHERE slug = ?")
    .get(slug) as ProductRow | undefined;
  if (!row) return null;
  return hydrate([row])[0] ?? null;
});

export const getProductById = cache((id: string): Product | null => {
  const row = getDb()
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(id) as ProductRow | undefined;
  if (!row) return null;
  return hydrate([row])[0] ?? null;
});

/** Опубликованные товары категории — основа страницы категории. */
export const getProductsByCategory = cache((categoryId: string): Product[] => {
  const rows = getDb()
    .prepare(
      `SELECT p.* FROM products p
       JOIN product_categories pc ON pc.product_id = p.id
       WHERE pc.category_id = ? AND p.is_published = 1
       ORDER BY p.created_at DESC`,
    )
    .all(categoryId) as ProductRow[];
  return hydrate(rows);
});

/** Товары раздела — для страницы вида /catalog/zhenskie. */
export const getProductsBySection = cache((sectionSlug: string): Product[] => {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT p.* FROM products p
       JOIN product_categories pc ON pc.product_id = p.id
       JOIN categories c ON c.id = pc.category_id
       WHERE c.section_slug = ? AND p.is_published = 1 AND c.is_published = 1
       ORDER BY p.created_at DESC`,
    )
    .all(sectionSlug) as ProductRow[];
  return hydrate(rows);
});

/** Цветовые вариации одной модели — блок «другие цвета» на карточке. */
export const getProductsByGroup = cache(
  (groupId: string, excludeProductId?: string): Product[] => {
    const rows = getDb()
      .prepare(
        `SELECT * FROM products
         WHERE group_id = ? AND is_published = 1 AND id != ?
         ORDER BY title`,
      )
      .all(groupId, excludeProductId ?? "") as ProductRow[];
    return hydrate(rows);
  },
);

export const getBestsellers = cache((limit = 8): Product[] => {
  const rows = getDb()
    .prepare(
      `SELECT * FROM products
       WHERE is_bestseller = 1 AND is_published = 1
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as ProductRow[];
  return hydrate(rows);
});

export const getNewArrivals = cache((limit = 10): Product[] => {
  const rows = getDb()
    .prepare(
      "SELECT * FROM products WHERE is_published = 1 ORDER BY created_at DESC LIMIT ?",
    )
    .all(limit) as ProductRow[];
  return hydrate(rows);
});

// ─── Остатки ─────────────────────────────────────────────────────────────────

/**
 * Списать остатки по позициям заказа.
 *
 * Либо списываются все позиции, либо ни одной: если хотя бы одного размера
 * не хватает, заказ не должен появиться наполовину. Проверка и списание
 * идут внутри одной транзакции, поэтому два одновременных заказа на
 * последнюю пару не могут пройти оба.
 */
export function decreaseStock(
  items: { variantId: string; quantity: number }[],
): boolean {
  return transaction(() => {
    const db = getDb();
    const select = db.prepare(
      "SELECT stock FROM product_variants WHERE id = ?",
    );
    const update = db.prepare(
      "UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?",
    );

    for (const item of items) {
      const row = select.get(item.variantId) as { stock: number } | undefined;
      if (!row || row.stock < item.quantity) {
        // Откат всей транзакции: better-sqlite3 откатывает по исключению.
        throw new Error("INSUFFICIENT_STOCK");
      }
      update.run(item.quantity, item.variantId, item.quantity);
    }
    return true;
  });
}

/** Вернуть остатки при отмене заказа. */
export function restoreStock(
  items: { variantId: string; quantity: number }[],
): void {
  transaction(() => {
    const update = getDb().prepare(
      "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
    );
    for (const item of items) {
      update.run(item.quantity, item.variantId);
    }
  });
}

/** Суммарный остаток товара по всем размерам. */
export function getProductStock(productId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COALESCE(SUM(stock), 0) AS total FROM product_variants WHERE product_id = ?",
    )
    .get(productId) as { total: number };
  return row.total;
}
