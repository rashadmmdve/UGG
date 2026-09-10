import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CatalogGrid } from "@/components/shop/CatalogGrid";
import { SECTIONS } from "@/lib/constants";
import {
  findCategoryByAlias,
  getCategoriesBySection,
  getCategoryBySlug,
  getColors,
  getProductsByCategory,
  getPublishedCategories,
} from "@/server/repositories/catalog";
import { getLandingsForCategory } from "@/server/repositories/seo";
import { categoryCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, itemListLd } from "@/server/seo/jsonld";
import { buildMetadata, minPrice } from "@/server/seo/meta";

export const revalidate = 600;

export function generateStaticParams() {
  return getPublishedCategories().map((category) => ({
    section: category.sectionSlug,
    category: category.slug,
  }));
}

/**
 * Разбор адреса категории: сначала по слагу, затем по синониму.
 * Синоним отдаётся постоянным редиректом, а не собственной страницей —
 * две страницы под один запрос конкурировали бы между собой.
 */
function resolve(sectionSlug: string, categorySlug: string) {
  if (!SECTIONS.some((section) => section.slug === sectionSlug)) notFound();

  const category = getCategoryBySlug(sectionSlug, categorySlug);
  if (category?.isPublished) return category;

  const byAlias = findCategoryByAlias(sectionSlug, categorySlug);
  if (byAlias?.isPublished) permanentRedirect(`/catalog/${sectionSlug}/${byAlias.slug}`);

  notFound();
}

export async function generateMetadata(
  props: PageProps<"/catalog/[section]/[category]">,
): Promise<Metadata> {
  const { section, category: categorySlug } = await props.params;
  const category = getCategoryBySlug(section, categorySlug);
  if (!category?.isPublished) return {};

  const products = getProductsByCategory(category.id);
  return buildMetadata({
    path: `/catalog/${section}/${category.slug}`,
    seo: category.seo,
    template: "category",
    tokens: { category: category.title, count: products.length, minPrice: minPrice(products) },
    images: category.image ? [category.image] : undefined,
  });
}

export default async function CategoryPage(props: PageProps<"/catalog/[section]/[category]">) {
  const { section, category: categorySlug } = await props.params;
  const category = resolve(section, categorySlug);

  const products = getProductsByCategory(category.id);
  const landings = getLandingsForCategory(section, category.slug);
  const crumbs = categoryCrumbs(section, category.slug);

  // Соседние категории раздела — в боковой панели, текущая подсвечена.
  // Так можно переключаться между категориями, не возвращаясь назад.
  const categoryLinks = getCategoriesBySection(section).map((item) => ({
    title: item.shortTitle ?? item.title,
    href: `/catalog/${section}/${item.slug}`,
    active: item.id === category.id,
  }));

  const header = (
    <>
      <h1 className="heading-section">{category.seo.h1 || category.title}</h1>
      {category.description && (
        <p className="mt-2 text-sm text-muted">{category.description}</p>
      )}
      {landings.length > 0 && (
        <nav aria-label="Подборки" className="mt-5 flex flex-wrap gap-2">
          {landings.map((landing) => (
            <Link
              key={landing.id}
              href={`/catalog/${section}/${category.slug}/${landing.facetSlug}`}
              className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent"
            >
              {landing.title}
            </Link>
          ))}
        </nav>
      )}
    </>
  );

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), itemListLd(products)]} />
      <Breadcrumbs items={crumbs} />

      {products.length === 0 ? (
        <>
          {header}
          <p className="mt-10 rounded-lg border border-line bg-sand p-6 text-sm text-muted">
            В этой категории пока нет товаров — загляните в соседние.
          </p>
        </>
      ) : (
        <Suspense fallback={<div className="py-24" aria-hidden />}>
          <CatalogGrid
            header={header}
            products={products}
            colors={getColors()}
            categories={categoryLinks}
          />
        </Suspense>
      )}

      {category.seo.seoText && (
        <section
          className="prose-seo mt-16 max-w-3xl border-t border-line pt-8 text-sm leading-relaxed text-muted"
          dangerouslySetInnerHTML={{ __html: category.seo.seoText }}
        />
      )}
    </div>
  );
}
