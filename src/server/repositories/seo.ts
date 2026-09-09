import "server-only";

import { cache } from "react";
import { nanoid } from "nanoid";

import { getDb } from "@/server/db/connection";
import {
  mapRedirect,
  mapSeoLanding,
  nowIso,
  toInt,
  type RedirectRow,
  type SeoLandingRow,
} from "@/server/db/mappers";
import type { Redirect, SeoLanding, SeoSettings } from "@/lib/types";

/**
 * Посадочные страницы фильтров и редиректы.
 *
 * Посадочные — это адреса вида /catalog/zhenskie/classic-mini/chernye.
 * Каждая заводится вручную и несёт собственный текст: автоматическая
 * генерация всех сочетаний фильтров превращает сайт в набор дорвеев,
 * которые Яндекс помечает как малополезные страницы.
 */

/** Минимальная длина собственного текста, ниже которой страница не публикуется. */
export const MIN_LANDING_TEXT_LENGTH = 400;

/** Минимум товаров в наличии, ниже которого страница уходит из индекса. */
export const MIN_LANDING_PRODUCTS = 3;

export const getSeoLandings = cache((): SeoLanding[] => {
  const rows = getDb()
    .prepare("SELECT * FROM seo_landings ORDER BY section_slug, category_slug, facet_slug")
    .all() as SeoLandingRow[];
  return rows.map(mapSeoLanding);
});

export const getPublishedLandings = cache((): SeoLanding[] =>
  getSeoLandings().filter((landing) => landing.isPublished),
);

export const getLanding = cache(
  (
    sectionSlug: string,
    categorySlug: string,
    facetSlug: string,
  ): SeoLanding | null =>
    getSeoLandings().find(
      (landing) =>
        landing.sectionSlug === sectionSlug &&
        landing.categorySlug === categorySlug &&
        landing.facetSlug === facetSlug,
    ) ?? null,
);

export const getLandingsForCategory = cache(
  (sectionSlug: string, categorySlug: string): SeoLanding[] =>
    getPublishedLandings().filter(
      (landing) =>
        landing.sectionSlug === sectionSlug &&
        landing.categorySlug === categorySlug,
    ),
);

/**
 * Готова ли посадочная к индексации.
 *
 * Проверяются все четыре условия сразу. Количество товаров передаётся
 * снаружи и перепроверяется при каждом рендере: если размер разобрали,
 * страница продолжает открываться для покупателей и внешних ссылок,
 * но получает noindex и выпадает из sitemap.
 */
export function isLandingIndexable(
  landing: SeoLanding,
  productCount: number,
): boolean {
  return (
    landing.isPublished &&
    landing.h1.trim().length > 0 &&
    landing.metaTitle.trim().length > 0 &&
    landing.metaDescription.trim().length > 0 &&
    landing.seoText.trim().length >= MIN_LANDING_TEXT_LENGTH &&
    productCount >= MIN_LANDING_PRODUCTS
  );
}

export function saveSeoLanding(
  input: Omit<SeoLanding, "id" | "createdAt" | "updatedAt"> & { id?: string },
): SeoLanding {
  const db = getDb();
  const now = nowIso();

  if (input.id) {
    db.prepare(
      `UPDATE seo_landings
       SET section_slug = ?, category_slug = ?, facet_slug = ?, facet_type = ?,
           facet_value = ?, title = ?, h1 = ?, meta_title = ?, meta_description = ?,
           seo_text = ?, aliases = ?, is_published = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.sectionSlug,
      input.categorySlug,
      input.facetSlug,
      input.facetType,
      input.facetValue,
      input.title,
      input.h1,
      input.metaTitle,
      input.metaDescription,
      input.seoText,
      JSON.stringify(input.aliases),
      toInt(input.isPublished),
      now,
      input.id,
    );
    return getSeoLandings().find((l) => l.id === input.id)!;
  }

  const id = nanoid(12);
  db.prepare(
    `INSERT INTO seo_landings
       (id, section_slug, category_slug, facet_slug, facet_type, facet_value,
        title, h1, meta_title, meta_description, seo_text, aliases,
        is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.sectionSlug,
    input.categorySlug,
    input.facetSlug,
    input.facetType,
    input.facetValue,
    input.title,
    input.h1,
    input.metaTitle,
    input.metaDescription,
    input.seoText,
    JSON.stringify(input.aliases),
    toInt(input.isPublished),
    now,
    now,
  );

  return { ...input, id, createdAt: now, updatedAt: now };
}

export function deleteSeoLanding(id: string): void {
  getDb().prepare("DELETE FROM seo_landings WHERE id = ?").run(id);
}

// ─── Редиректы ───────────────────────────────────────────────────────────────

export const getRedirects = cache((): Redirect[] => {
  const rows = getDb()
    .prepare('SELECT id, "from", "to", code FROM redirects')
    .all() as RedirectRow[];
  return rows.map(mapRedirect);
});

export const findRedirect = cache((from: string): Redirect | null => {
  const row = getDb()
    .prepare('SELECT id, "from", "to", code FROM redirects WHERE "from" = ?')
    .get(from) as RedirectRow | undefined;
  return row ? mapRedirect(row) : null;
});

export function saveRedirect(input: Omit<Redirect, "id"> & { id?: string }): void {
  const db = getDb();
  if (input.id) {
    db.prepare('UPDATE redirects SET "from" = ?, "to" = ?, code = ? WHERE id = ?').run(
      input.from,
      input.to,
      input.code,
      input.id,
    );
    return;
  }
  db.prepare(
    'INSERT INTO redirects (id, "from", "to", code) VALUES (?, ?, ?, ?)',
  ).run(nanoid(12), input.from, input.to, input.code);
}

export function deleteRedirect(id: string): void {
  getDb().prepare("DELETE FROM redirects WHERE id = ?").run(id);
}

// ─── Настройки SEO ───────────────────────────────────────────────────────────

const DEFAULT_SEO_SETTINGS: SeoSettings = {
  yandexMetrikaId: "",
  googleAnalyticsId: "",
  yandexVerification: "",
  googleVerification: "",
  templates: {
    category: {
      title: "{category} — купить оригинал | {site}",
      description:
        "{category}: {count} моделей в наличии, от {minPrice} ₽. " +
        "Оригинальная обувь UGG® с доставкой по России. Обмен и возврат 14 дней.",
    },
    product: {
      title: "{title} — купить оригинал | {site}",
      description:
        "{title} за {price} ₽. Оригинал, гарантия подлинности, " +
        "доставка по России, обмен и возврат 14 дней.",
    },
    landing: {
      title: "{category} {facet} — купить оригинал | {site}",
      description:
        "{category} {facet}: {count} моделей в наличии от {minPrice} ₽. " +
        "Оригинальная обувь UGG® с доставкой по России.",
    },
  },
};

export const getSeoSettings = cache((): SeoSettings => {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'seo'")
    .get() as { value: string } | undefined;

  if (!row) return DEFAULT_SEO_SETTINGS;

  try {
    return { ...DEFAULT_SEO_SETTINGS, ...(JSON.parse(row.value) as SeoSettings) };
  } catch {
    return DEFAULT_SEO_SETTINGS;
  }
});

export function saveSeoSettings(settings: SeoSettings): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('seo', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(JSON.stringify(settings));
}
