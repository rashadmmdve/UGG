import "server-only";

import { revalidatePath } from "next/cache";

import { getCategoryById } from "@/server/repositories/catalog";
import { getLandingsForCategory } from "@/server/repositories/seo";
import type { Category, Product, SeoLanding } from "@/lib/types";

/**
 * Инвалидация кэша страниц — в одном месте.
 *
 * Страницы каталога отдаются из кэша и обновляются раз в десять минут.
 * Чтобы правка в админке была видна сразу, кэш сбрасывается точечно.
 * В VOOBRAZHI таких вызовов было около сорока, разбросанных по действиям;
 * при трёхуровневом дереве адресов такой разброс гарантированно теряет
 * путь — например, посадочную страницу, в которую входит товар.
 */

/** Адреса, которые зависят от категории: она сама, раздел и её посадочные. */
function categoryPaths(category: Category): string[] {
  const base = `/catalog/${category.sectionSlug}/${category.slug}`;
  const landings = getLandingsForCategory(category.sectionSlug, category.slug);

  return [
    base,
    `/catalog/${category.sectionSlug}`,
    ...landings.map((landing) => `${base}/${landing.facetSlug}`),
  ];
}

/**
 * Товар сохранён, удалён, либо у него изменился остаток.
 *
 * Остаток — тоже повод: он управляет полем наличия в разметке карточки
 * и порогом публикации посадочных страниц. Поэтому вызывается и при
 * оформлении заказа, а не только из админки.
 */
export function revalidateProduct(product: Product, previousSlug?: string): void {
  const paths = new Set<string>([
    `/product/${product.slug}`,
    "/catalog",
    "/sitemap-index.xml",
  ]);

  // Прежний адрес тоже сбрасываем: после переименования он должен
  // перестать отдавать старую карточку из кэша.
  if (previousSlug && previousSlug !== product.slug) {
    paths.add(`/product/${previousSlug}`);
  }

  if (product.isBestseller) paths.add("/");

  for (const categoryId of product.categoryIds) {
    const category = getCategoryById(categoryId);
    if (category) categoryPaths(category).forEach((path) => paths.add(path));
  }

  for (const path of paths) revalidatePath(path);
  // Карты сайта — отдельные маршруты, а не страницы; сбрасываются по типу.
  revalidatePath("/sitemap/products.xml");
  revalidatePath("/sitemap/catalog.xml");
}

/** Категория сохранена или удалена. Меняется и меню — сбрасываем макет. */
export function revalidateCategoryTree(category: Category): void {
  for (const path of categoryPaths(category)) revalidatePath(path);
  revalidatePath("/catalog");
  revalidatePath("/sitemap/catalog.xml");
  // Категории попадают в меню шапки на всех страницах.
  revalidatePath("/", "layout");
}

export function revalidateLanding(landing: SeoLanding): void {
  revalidatePath(
    `/catalog/${landing.sectionSlug}/${landing.categorySlug}/${landing.facetSlug}`,
  );
  revalidatePath(`/catalog/${landing.sectionSlug}/${landing.categorySlug}`);
  revalidatePath("/sitemap/catalog.xml");
}

/** Статья сохранена или удалена. Прежний адрес тоже сбрасываем. */
export function revalidateArticle(slug: string, previousSlug?: string): void {
  revalidatePath("/articles");
  revalidatePath(`/articles/${slug}`);
  if (previousSlug && previousSlug !== slug) revalidatePath(`/articles/${previousSlug}`);
  revalidatePath("/sitemap/articles.xml");
}

/** Справочники (цвета, линии, сетки) влияют на все карточки — сброс целиком. */
export function revalidateCatalog(): void {
  revalidatePath("/", "layout");
}

/** Тексты витрины и настройки: главная, информационные страницы, разметка. */
export function revalidateContent(): void {
  revalidatePath("/", "layout");
}
