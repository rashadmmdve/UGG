import "server-only";

import { SALE_SECTION, SECTIONS, SITE_URL } from "@/lib/constants";
import { getCategoryById, getCategoryBySlug } from "@/server/repositories/catalog";
import type { Product, SeoLanding } from "@/lib/types";

/**
 * Хлебные крошки.
 *
 * Одна функция на всё: и видимая навигация, и разметка BreadcrumbList
 * строятся из этого результата. Если считать их порознь, они рано или
 * поздно разойдутся — а расхождение видимого и размеченного как раз и
 * считается попыткой обмануть поисковик.
 */

export type Crumb = {
  title: string;
  /** Абсолютный адрес. У последнего элемента ссылки нет. */
  url: string | null;
};

const sectionTitle = (slug: string): string =>
  slug === SALE_SECTION.slug
    ? SALE_SECTION.title
    : (SECTIONS.find((section) => section.slug === slug)?.title ?? slug);

const HOME: Crumb = { title: "Главная", url: SITE_URL };
const CATALOG: Crumb = { title: "Каталог", url: `${SITE_URL}/catalog` };

export function catalogCrumbs(): Crumb[] {
  return [HOME, { ...CATALOG, url: null }];
}

/** Информационная страница первого уровня: Главная → Заголовок. */
export function pageCrumbs(title: string): Crumb[] {
  return [HOME, { title, url: null }];
}

/** Статья: Главная → Статьи → Заголовок. */
export function articleCrumbs(title: string): Crumb[] {
  return [HOME, { title: "Статьи", url: `${SITE_URL}/articles` }, { title, url: null }];
}

export function sectionCrumbs(sectionSlug: string): Crumb[] {
  return [HOME, CATALOG, { title: sectionTitle(sectionSlug), url: null }];
}

export function categoryCrumbs(
  sectionSlug: string,
  categorySlug: string,
): Crumb[] {
  const category = getCategoryBySlug(sectionSlug, categorySlug);

  return [
    HOME,
    CATALOG,
    {
      title: sectionTitle(sectionSlug),
      url: `${SITE_URL}/catalog/${sectionSlug}`,
    },
    { title: category?.title ?? categorySlug, url: null },
  ];
}

export function landingCrumbs(landing: SeoLanding): Crumb[] {
  const category = getCategoryBySlug(landing.sectionSlug, landing.categorySlug);

  return [
    HOME,
    CATALOG,
    {
      title: sectionTitle(landing.sectionSlug),
      url: `${SITE_URL}/catalog/${landing.sectionSlug}`,
    },
    {
      title: category?.title ?? landing.categorySlug,
      url: `${SITE_URL}/catalog/${landing.sectionSlug}/${landing.categorySlug}`,
    },
    { title: landing.h1 || landing.title, url: null },
  ];
}

/**
 * Крошки карточки товара.
 *
 * Родитель берётся из основной категории товара и не зависит от того,
 * по какой ссылке покупатель пришёл: адрес карточки один, и путь к ней
 * в разметке тоже должен быть один.
 */
export function productCrumbs(product: Product): Crumb[] {
  const category = product.primaryCategoryId
    ? getCategoryById(product.primaryCategoryId)
    : null;

  if (!category) {
    return [HOME, CATALOG, { title: product.title, url: null }];
  }

  return [
    HOME,
    CATALOG,
    {
      title: sectionTitle(category.sectionSlug),
      url: `${SITE_URL}/catalog/${category.sectionSlug}`,
    },
    {
      title: category.title,
      url: `${SITE_URL}/catalog/${category.sectionSlug}/${category.slug}`,
    },
    { title: product.title, url: null },
  ];
}
