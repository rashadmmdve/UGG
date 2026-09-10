import type { MetadataRoute } from "next";

import { SALE_SECTION, SECTIONS, SITE_URL } from "@/lib/constants";
import {
  getCategoryBySlug,
  getProductsByCategory,
  getProductsBySection,
  getSaleProducts,
  getPublishedCategories,
  getPublishedProducts,
} from "@/server/repositories/catalog";
import { getPublishedArticles } from "@/server/repositories/articles";
import { getContent, isLegalReady } from "@/server/repositories/settings";
import { getPublishedLandings, isLandingIndexable } from "@/server/repositories/seo";
import { availableCount, filterByFacet } from "@/server/catalog/facets";

/**
 * Карта сайта, разбитая по типу содержимого.
 *
 * Разбивка именно по типу, а не кусками по пятьдесят тысяч адресов:
 * в Яндекс Вебмастере покрытие индексом показывается отдельно по каждому
 * файлу, и так сразу видно, что именно выпадает — посадочные страницы
 * или карточки товаров.
 *
 * Файлы доступны по адресам /sitemap/{id}.xml. Индексный файл, который их
 * перечисляет, Next не создаёт — он собирается вручную в
 * src/app/sitemap-index.xml/route.ts, и именно на него указывает robots.txt.
 */
export async function generateSitemaps() {
  return [{ id: "static" }, { id: "catalog" }, { id: "products" }, { id: "articles" }];
}

/** Статические страницы: главная, информационные, справочные. */
function staticSitemap(): MetadataRoute.Sitemap {
  const legal = getContent().legal;

  const pages = [
    { path: "", changeFrequency: "daily" as const, priority: 1 },
    { path: "/catalog", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/razmery-ugg", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/uhod-za-ugg", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/dostavka-i-oplata", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/obmen-i-vozvrat", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/o-magazine", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/kontakty", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/articles", changeFrequency: "weekly" as const, priority: 0.7 },
    // Юридические страницы попадают в карту, только когда дописаны —
    // пустые и с незаполненными подстановками отдаются с noindex.
    ...(isLegalReady(legal.oferta)
      ? [{ path: "/oferta", changeFrequency: "yearly" as const, priority: 0.3 }]
      : []),
    ...(isLegalReady(legal.privacy)
      ? [{ path: "/politika-konfidentsialnosti", changeFrequency: "yearly" as const, priority: 0.3 }]
      : []),
  ];

  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

/** Разделы, категории и опубликованные посадочные страницы фильтров. */
function catalogSitemap(): MetadataRoute.Sitemap {
  // Разделы отбираются по тому же правилу, что и категории: пока в разделе
  // нет ни одного товара, страница отдаётся с noindex и в карту не идёт.
  const sections: MetadataRoute.Sitemap = SECTIONS.filter(
    (section) => getProductsBySection(section.slug).length > 0,
  ).map((section) => ({
    url: `${SITE_URL}/catalog/${section.slug}`,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  // Распродажа — по тому же правилу: пока подборка пуста, страница
  // отдаётся с noindex и в карту не идёт.
  if (getSaleProducts().length > 0) {
    sections.push({
      url: `${SITE_URL}/catalog/${SALE_SECTION.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  /**
   * Категории без товаров не попадают в карту сайта: страница всё равно
   * отдаётся с noindex, и предлагать поисковику обойти адрес, который мы
   * же закрыли от индексации, — трата краулингового бюджета.
   */
  const categories: MetadataRoute.Sitemap = getPublishedCategories()
    .filter((category) => getProductsByCategory(category.id).length > 0)
    .map((category) => ({
      url: `${SITE_URL}/catalog/${category.sectionSlug}/${category.slug}`,
      lastModified: new Date(category.updatedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  /**
   * Посадочные страницы фильтров.
   *
   * Отбор идёт по той же проверке, что закрывает страницу от индексации
   * при рендере, а не просто по флагу «опубликована». Иначе посадочная,
   * у которой разобрали товары, отдавала бы noindex и одновременно
   * значилась в карте сайта — противоречивый сигнал.
   */
  const landings: MetadataRoute.Sitemap = getPublishedLandings()
    .filter((landing) => {
      const category = getCategoryBySlug(
        landing.sectionSlug,
        landing.categorySlug,
      );
      if (!category) return false;

      const products = filterByFacet(
        getProductsByCategory(category.id),
        landing.facetType,
        landing.facetValue,
      );
      return isLandingIndexable(landing, availableCount(products));
    })
    .map((landing) => ({
      url: `${SITE_URL}/catalog/${landing.sectionSlug}/${landing.categorySlug}/${landing.facetSlug}`,
      lastModified: new Date(landing.updatedAt),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...sections, ...categories, ...landings];
}

function productsSitemap(): MetadataRoute.Sitemap {
  return getPublishedProducts().map((product) => ({
    url: `${SITE_URL}/product/${product.slug}`,
    lastModified: new Date(product.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));
}

function articlesSitemap(): MetadataRoute.Sitemap {
  return getPublishedArticles().map((article) => ({
    url: `${SITE_URL}/articles/${article.slug}`,
    lastModified: new Date(article.updatedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  // В Next 16 идентификатор файла приходит промисом — это ломающее
  // изменение относительно прежних версий.
  const id = await props.id;

  switch (id) {
    case "catalog":
      return catalogSitemap();
    case "products":
      return productsSitemap();
    case "articles":
      return articlesSitemap();
    default:
      return staticSitemap();
  }
}
