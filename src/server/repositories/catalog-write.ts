import "server-only";

import { nanoid } from "nanoid";

import { getDb, transaction } from "@/server/db/connection";
import { nowIso, toInt } from "@/server/db/mappers";
import {
  getCategoryById,
  getProductById,
  getProducts,
} from "@/server/repositories/catalog";
import type {
  Category,
  Color,
  ModelLine,
  Product,
  ProductVariant,
  SizeChart,
} from "@/lib/types";

/**
 * Запись в каталог: товары, категории, модельные линии, цвета, размерные
 * сетки. Чтение живёт в catalog.ts — разделение намеренное: читающих
 * функций много и они обёрнуты в кэш рендера, а пишущих мало и каждая
 * идёт транзакцией.
 */

// ─── Товары ──────────────────────────────────────────────────────────────────

export type ProductInput = Omit<
  Product,
  "id" | "createdAt" | "updatedAt" | "rating" | "variants"
> & {
  id?: string;
  variants: Array<Omit<ProductVariant, "id"> & { id?: string }>;
};

/**
 * Сохранить товар: создать или обновить.
 *
 * Идентификаторы вариантов размера сохраняются для совпадающих размеров.
 * На них ссылаются позиции заказов и корзины покупателей: если при каждом
 * сохранении раздавать новые, уже оформленный заказ потеряет связь с
 * товаром, а корзина в браузере покупателя станет недействительной.
 */
export function saveProduct(input: ProductInput): Product {
  return transaction(() => {
    const db = getDb();
    const now = nowIso();
    const existing = input.id ? getProductById(input.id) : null;
    // Переданный id для новой записи сохраняется: вызывающий код может
    // заранее знать адрес, куда перенаправить после создания.
    const id = existing?.id ?? input.id ?? nanoid(12);

    const values = [
      input.slug,
      input.title,
      input.sku || null,
      input.description,
      input.gender,
      input.modelLineId,
      input.colorId,
      input.primaryCategoryId,
      input.groupId || null,
      JSON.stringify(input.materials),
      JSON.stringify(input.seasons),
      JSON.stringify(input.specs),
      input.shaftHeightCm,
      input.heelHeightCm,
      input.price,
      input.oldPrice,
      input.costPrice,
      JSON.stringify(input.images),
      input.weight,
      input.length,
      input.width,
      input.height,
      toInt(input.isPublished),
      toInt(input.isBestseller),
      toInt(input.isNew),
      toInt(input.isSale),
      JSON.stringify(input.seo),
      now,
    ];

    if (existing) {
      db.prepare(
        `UPDATE products SET
           slug = ?, title = ?, sku = ?, description = ?, gender = ?,
           model_line_id = ?, color_id = ?, primary_category_id = ?, group_id = ?,
           materials = ?, seasons = ?, specs = ?, shaft_height_cm = ?, heel_height_cm = ?,
           price = ?, old_price = ?, cost_price = ?, images = ?, weight = ?, length = ?, width = ?,
           height = ?, is_published = ?, is_bestseller = ?, is_new = ?, is_sale = ?,
           seo = ?, updated_at = ?
         WHERE id = ?`,
      ).run(...values, id);
    } else {
      db.prepare(
        `INSERT INTO products
           (slug, title, sku, description, gender, model_line_id, color_id,
            primary_category_id, group_id, materials, seasons, specs, shaft_height_cm,
            heel_height_cm, price, old_price, cost_price, images, weight, length, width,
            height, is_published, is_bestseller, is_new, is_sale, seo, updated_at,
            id, rating_value, rating_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, NULL, 0, ?)`,
      ).run(...values, id, now);
    }

    // Связи с категориями пересобираются целиком: набор небольшой,
    // а вычислять разницу дороже, чем перезаписать.
    db.prepare("DELETE FROM product_categories WHERE product_id = ?").run(id);
    const link = db.prepare(
      "INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)",
    );
    for (const categoryId of new Set(input.categoryIds)) {
      link.run(id, categoryId);
    }

    // Варианты: совпадающие размеры сохраняют id, остальные создаются,
    // исчезнувшие удаляются.
    const previous = new Map(
      (existing?.variants ?? []).map((variant) => [variant.sizeEu, variant.id]),
    );
    const keep = new Set<string>();

    const upsert = db.prepare(
      `INSERT INTO product_variants (id, product_id, size_eu, insole_cm, size_us, stock, barcode, marking_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         size_eu = excluded.size_eu, insole_cm = excluded.insole_cm, size_us = excluded.size_us,
         stock = excluded.stock, barcode = excluded.barcode,
         marking_code = excluded.marking_code`,
    );

    for (const variant of input.variants) {
      const variantId = previous.get(variant.sizeEu) ?? variant.id ?? nanoid(12);
      keep.add(variantId);
      upsert.run(
        variantId,
        id,
        variant.sizeEu,
        variant.insoleCm,
        variant.sizeUs || null,
        variant.stock,
        variant.barcode || null,
        variant.markingCode || null,
      );
    }

    if (keep.size > 0) {
      const placeholders = [...keep].map(() => "?").join(",");
      db.prepare(
        `DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (${placeholders})`,
      ).run(id, ...keep);
    } else {
      db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(id);
    }

    return getProductById(id)!;
  });
}

export function deleteProduct(id: string): void {
  // Варианты и связи с категориями удаляются каскадом по внешним ключам.
  getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
}

/**
 * Клонировать товар под другую цветовую вариацию.
 *
 * Именно для этого клонирование и нужно: у одной модели пять-восемь
 * цветов, и они отличаются только оттенком и фотографиями. Копия
 * получает те же размеры с нулевым остатком, ту же группу (чтобы
 * попасть в блок «другие цвета»), но без цвета, без фото и
 * неопубликованной — чтобы недозаполненная карточка не ушла на витрину.
 */
export function cloneProduct(sourceId: string): Product | null {
  const source = getProductById(sourceId);
  if (!source) return null;

  const slugs = new Set(getProducts().map((product) => product.slug));
  let slug = `${source.slug}-kopiya`;
  for (let n = 2; slugs.has(slug); n += 1) slug = `${source.slug}-kopiya-${n}`;

  return saveProduct({
    slug,
    title: `${source.title} (копия)`,
    sku: null,
    description: source.description,
    gender: source.gender,
    modelLineId: source.modelLineId,
    colorId: null,
    categoryIds: source.categoryIds,
    primaryCategoryId: source.primaryCategoryId,
    // Группа своя у каждой модели; если у исходника её не было — заводим,
    // иначе оригинал и копия не узнают друг друга.
    groupId: source.groupId ?? source.slug,
    materials: source.materials,
    seasons: source.seasons,
    specs: source.specs,
    shaftHeightCm: source.shaftHeightCm,
    heelHeightCm: source.heelHeightCm,
    price: source.price,
    oldPrice: source.oldPrice,
    costPrice: source.costPrice,
    images: [],
    variants: source.variants.map((variant) => ({
      sizeEu: variant.sizeEu,
      insoleCm: variant.insoleCm,
      sizeUs: variant.sizeUs,
      stock: 0,
    })),
    weight: source.weight,
    length: source.length,
    width: source.width,
    height: source.height,
    isPublished: false,
    isBestseller: false,
    isNew: source.isNew,
    isSale: false,
    seo: {},
  });
}

/** Занят ли слаг другим товаром — проверка уникальности при сохранении. */
export function isProductSlugTaken(slug: string, exceptId?: string): boolean {
  const row = getDb()
    .prepare("SELECT id FROM products WHERE slug = ? AND id != ?")
    .get(slug, exceptId ?? "") as { id: string } | undefined;
  return Boolean(row);
}

// ─── Категории ───────────────────────────────────────────────────────────────

export type CategoryInput = Omit<Category, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

export function saveCategory(input: CategoryInput): Category {
  const db = getDb();
  const now = nowIso();
  const existing = input.id ? getCategoryById(input.id) : null;
  const id = existing?.id ?? nanoid(12);

  const values = [
    input.slug,
    input.sectionSlug,
    input.title,
    input.shortTitle || null,
    input.description,
    input.image,
    input.order,
    toInt(input.isPublished),
    JSON.stringify(input.aliases),
    JSON.stringify(input.seo),
    now,
  ];

  if (existing) {
    db.prepare(
      `UPDATE categories SET
         slug = ?, section_slug = ?, title = ?, short_title = ?, description = ?,
         image = ?, sort_order = ?, is_published = ?, aliases = ?, seo = ?, updated_at = ?
       WHERE id = ?`,
    ).run(...values, id);
  } else {
    db.prepare(
      `INSERT INTO categories
         (slug, section_slug, title, short_title, description, image, sort_order,
          is_published, aliases, seo, updated_at, id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(...values, id, now);
  }

  return getCategoryById(id)!;
}

export function deleteCategory(id: string): void {
  getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
}

/**
 * Занят ли адрес внутри раздела — слагом другой категории или чьим-то
 * синонимом. Синоним считается занятым адресом: он отдаёт редирект, и
 * новая категория по этому пути просто не откроется.
 */
export function isCategorySlugTaken(
  sectionSlug: string,
  slug: string,
  exceptId?: string,
): boolean {
  const rows = getDb()
    .prepare(
      "SELECT id, slug, aliases FROM categories WHERE section_slug = ? AND id != ?",
    )
    .all(sectionSlug, exceptId ?? "") as {
    id: string;
    slug: string;
    aliases: string;
  }[];

  return rows.some((row) => {
    if (row.slug === slug) return true;
    try {
      return (JSON.parse(row.aliases) as string[]).includes(slug);
    } catch {
      return false;
    }
  });
}

// ─── Модельные линии ─────────────────────────────────────────────────────────

export function saveModelLine(input: Omit<ModelLine, "id"> & { id?: string }): void {
  const db = getDb();
  const values = [
    input.slug,
    input.title,
    input.description,
    JSON.stringify(input.genders),
    input.sizeChartId,
    input.order,
  ];

  if (input.id) {
    db.prepare(
      `UPDATE model_lines SET slug = ?, title = ?, description = ?, genders = ?,
         size_chart_id = ?, sort_order = ? WHERE id = ?`,
    ).run(...values, input.id);
    return;
  }

  db.prepare(
    `INSERT INTO model_lines (slug, title, description, genders, size_chart_id, sort_order, id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(...values, nanoid(12));
}

export function deleteModelLine(id: string): void {
  getDb().prepare("DELETE FROM model_lines WHERE id = ?").run(id);
}

// ─── Цвета ───────────────────────────────────────────────────────────────────

export function saveColor(input: Omit<Color, "id"> & { id?: string }): void {
  const db = getDb();
  if (input.id) {
    db.prepare(
      'UPDATE colors SET slug = ?, title = ?, "group" = ?, hex = ? WHERE id = ?',
    ).run(input.slug, input.title, input.group, input.hex, input.id);
    return;
  }
  db.prepare(
    'INSERT INTO colors (id, slug, title, "group", hex) VALUES (?, ?, ?, ?, ?)',
  ).run(nanoid(12), input.slug, input.title, input.group, input.hex);
}

export function deleteColor(id: string): void {
  getDb().prepare("DELETE FROM colors WHERE id = ?").run(id);
}

// ─── Размерные сетки ─────────────────────────────────────────────────────────

export function saveSizeChart(input: Omit<SizeChart, "id"> & { id?: string }): void {
  const db = getDb();
  const rows = JSON.stringify(input.rows);
  if (input.id) {
    db.prepare(
      "UPDATE size_charts SET slug = ?, title = ?, gender = ?, rows = ? WHERE id = ?",
    ).run(input.slug, input.title, input.gender, rows, input.id);
    return;
  }
  db.prepare(
    "INSERT INTO size_charts (id, slug, title, gender, rows) VALUES (?, ?, ?, ?, ?)",
  ).run(nanoid(12), input.slug, input.title, input.gender, rows);
}

export function deleteSizeChart(id: string): void {
  getDb().prepare("DELETE FROM size_charts WHERE id = ?").run(id);
}

/** Показать или скрыть сразу несколько товаров — массовое действие из списка. */
export function setProductsPublished(ids: string[], published: boolean): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  return getDb()
    .prepare(`UPDATE products SET is_published = ?, updated_at = ? WHERE id IN (${placeholders})`)
    .run(published ? 1 : 0, new Date().toISOString(), ...ids).changes;
}
