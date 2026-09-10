import "server-only";

import { CATALOG_TILES, SALE_SECTION, SECTIONS } from "@/lib/constants";
import { getContent } from "@/server/repositories/settings";

/**
 * Названия разделов каталога.
 *
 * Слаг зашит в код — это часть адреса, менять его нельзя без редиректов.
 * А название владелец магазина правит в админке: «Женские» может стать
 * «Женщинам», распродажа — «Скидками», и переписывать ради этого код
 * незачем.
 *
 * Разрешение идёт в одном месте, чтобы витрина, крошки и метатеги не
 * разошлись: расхождение видимого заголовка и размеченного поисковик
 * считает попыткой его обмануть.
 */

const DEFAULTS = new Map<string, string>([
  ...SECTIONS.map((section) => [section.slug, section.title] as const),
  [SALE_SECTION.slug, SALE_SECTION.title],
]);

/** Название раздела с учётом правки в админке. */
export function sectionTitle(slug: string): string {
  const custom = getContent().sectionTitles?.[slug]?.trim();
  return custom || DEFAULTS.get(slug) || slug;
}

/** Разделы и распродажа с текущими названиями — для меню, плиток и списков. */
export function catalogTiles(): { slug: string; title: string }[] {
  return CATALOG_TILES.map((tile) => ({ slug: tile.slug, title: sectionTitle(tile.slug) }));
}

/** Только разделы по полу, без распродажи. */
export function genderSections(): { slug: string; title: string }[] {
  return SECTIONS.map((section) => ({ slug: section.slug, title: sectionTitle(section.slug) }));
}
