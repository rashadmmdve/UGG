import "server-only";

import { CATALOG_TILES, SALE_SECTION, SECTIONS } from "@/lib/constants";
import { getSaleProducts } from "@/server/repositories/catalog";
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
  return sectionCaption(slug) || DEFAULTS.get(slug) || slug;
}

/**
 * Подпись плитки на главной — только то, что владелец ввёл сам. Пустое
 * поле в админке значит «без подписи»: на снимке слово уже может быть
 * (баннер распродажи), и дублировать его нечем. В меню, крошках и
 * заголовке раздела пустоты быть не может — там действует sectionTitle().
 */
export function sectionCaption(slug: string): string | null {
  return getContent().sectionTitles?.[slug]?.trim() || null;
}

/** Разделы и распродажа с текущими названиями — для меню, плиток и списков. */
export function catalogTiles(): { slug: string; title: string }[] {
  return CATALOG_TILES.map((tile) => ({ slug: tile.slug, title: sectionTitle(tile.slug) }));
}

/** Только разделы по полу, без распродажи. */
export function genderSections(): { slug: string; title: string }[] {
  return SECTIONS.map((section) => ({ slug: section.slug, title: sectionTitle(section.slug) }));
}

/**
 * Плитки на главной. Распродажа появляется, только когда в ней есть
 * товары — тем же правилом, что и пункт в меню: пустая плитка обещает
 * то, чего нет.
 */
export function homeTiles(): { slug: string; title: string; caption: string | null }[] {
  const slugs: string[] = SECTIONS.map((section) => section.slug);
  if (getSaleProducts().length > 0) slugs.push(SALE_SECTION.slug);
  return slugs.map((slug) => ({ slug, title: sectionTitle(slug), caption: sectionCaption(slug) }));
}
