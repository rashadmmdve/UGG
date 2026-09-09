import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SECTIONS } from "@/lib/constants";
import { plural } from "@/lib/utils";
import {
  findCategoryByAlias,
  getCategoryBySlug,
  getProductsByCategory,
  getPublishedCategories,
} from "@/server/repositories/catalog";
import { getLandingsForCategory } from "@/server/repositories/seo";
import { categoryCrumbs } from "@/server/seo/breadcrumbs";
import { buildMetadata, minPrice } from "@/server/seo/meta";

export const revalidate = 600;

export function generateStaticParams() {
  return getPublishedCategories().map((category) => ({
    section: category.sectionSlug,
    category: category.slug,
  }));
}

/**
 * Разбор адреса категории.
 *
 * Порядок важен: сначала ищем категорию по слагу, затем — по синониму.
 * Синоним отдаётся постоянным редиректом, а не собственной страницей:
 * иначе `korotkie-uggi` и `classic-short` конкурировали бы в выдаче
 * между собой по одному и тому же запросу.
 */
function resolve(sectionSlug: string, categorySlug: string) {
  if (!SECTIONS.some((section) => section.slug === sectionSlug)) notFound();

  const category = getCategoryBySlug(sectionSlug, categorySlug);
  if (category?.isPublished) return category;

  const byAlias = findCategoryByAlias(sectionSlug, categorySlug);
  if (byAlias?.isPublished) {
    permanentRedirect(`/catalog/${sectionSlug}/${byAlias.slug}`);
  }

  notFound();
}

export async function generateMetadata(
  props: PageProps<"/catalog/[section]/[category]">,
): Promise<Metadata> {
  const { section, category: categorySlug } = await props.params;
  const category = getCategoryBySlug(section, categorySlug);

  // Синоним отработает редиректом в самой странице — метаданные ему не нужны.
  if (!category?.isPublished) return {};

  const products = getProductsByCategory(category.id);

  return buildMetadata({
    path: `/catalog/${section}/${category.slug}`,
    seo: category.seo,
    template: "category",
    tokens: {
      category: category.title,
      count: products.length,
      minPrice: minPrice(products),
    },
    images: category.image ? [category.image] : undefined,
  });
}

export default async function CategoryPage(
  props: PageProps<"/catalog/[section]/[category]">,
) {
  const { section, category: categorySlug } = await props.params;
  const category = resolve(section, categorySlug);

  const products = getProductsByCategory(category.id);
  const landings = getLandingsForCategory(section, category.slug);

  return (
    <main className="container-page mx-auto max-w-6xl py-10">
      <Breadcrumbs items={categoryCrumbs(section, category.slug)} />

      <h1 className="heading-section mt-6">{category.seo.h1 || category.title}</h1>
      <p className="mt-2 text-muted">
        {products.length}{" "}
        {plural(products.length, ["модель", "модели", "моделей"])} в наличии
      </p>

      {landings.length > 0 && (
        <nav aria-label="Подборки" className="mt-6 flex flex-wrap gap-2">
          {landings.map((landing) => (
            <a
              key={landing.id}
              href={`/catalog/${section}/${category.slug}/${landing.facetSlug}`}
              className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent"
            >
              {landing.title}
            </a>
          ))}
        </nav>
      )}

      {products.length === 0 ? (
        <p className="mt-10 rounded-lg border border-line bg-sand p-6 text-muted">
          В этой категории пока нет товаров. Добавьте их через панель управления.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              {/* Обычная ссылка, а не кнопка: иначе робот не обойдёт каталог. */}
              <a href={`/product/${product.slug}`} className="block group">
                <span className="block text-sm group-hover:text-accent">
                  {product.title}
                </span>
                <span className="mt-1 block font-semibold">
                  {product.price.toLocaleString("ru-RU")} ₽
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {category.seo.seoText && (
        <section
          className="mt-16 border-t border-line pt-8 text-sm leading-relaxed text-muted"
          dangerouslySetInnerHTML={{ __html: category.seo.seoText }}
        />
      )}
    </main>
  );
}
