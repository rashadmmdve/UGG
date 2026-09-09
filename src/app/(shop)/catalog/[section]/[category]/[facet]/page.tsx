import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/shop/ProductCard";
import { plural } from "@/lib/utils";
import { availableCount, filterByFacet } from "@/server/catalog/facets";
import { getCategoryBySlug, getProductsByCategory } from "@/server/repositories/catalog";
import {
  getLanding,
  getPublishedLandings,
  getSeoLandings,
  isLandingIndexable,
  MIN_LANDING_PRODUCTS,
} from "@/server/repositories/seo";
import { landingCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, itemListLd } from "@/server/seo/jsonld";
import { buildMetadata, minPrice } from "@/server/seo/meta";
import type { SeoLanding } from "@/lib/types";

export const revalidate = 600;

/** Предгенерируются только опубликованные посадочные; прочие адреса — 404. */
export function generateStaticParams() {
  return getPublishedLandings().map((landing) => ({
    section: landing.sectionSlug,
    category: landing.categorySlug,
    facet: landing.facetSlug,
  }));
}

function productsFor(landing: SeoLanding) {
  const category = getCategoryBySlug(landing.sectionSlug, landing.categorySlug);
  if (!category) return [];
  return filterByFacet(getProductsByCategory(category.id), landing.facetType, landing.facetValue);
}

function resolve(section: string, category: string, facet: string) {
  const landing = getLanding(section, category, facet);
  if (landing?.isPublished) return landing;

  const byAlias = getSeoLandings().find(
    (item) =>
      item.sectionSlug === section &&
      item.categorySlug === category &&
      item.isPublished &&
      item.aliases.includes(facet),
  );
  if (byAlias) permanentRedirect(`/catalog/${section}/${category}/${byAlias.facetSlug}`);

  notFound();
}

export async function generateMetadata(
  props: PageProps<"/catalog/[section]/[category]/[facet]">,
): Promise<Metadata> {
  const { section, category, facet } = await props.params;
  const landing = getLanding(section, category, facet);
  if (!landing?.isPublished) return {};

  const products = productsFor(landing);
  const categoryEntity = getCategoryBySlug(section, category);

  return buildMetadata({
    path: `/catalog/${section}/${category}/${facet}`,
    seo: {
      metaTitle: landing.metaTitle,
      metaDescription: landing.metaDescription,
      h1: landing.h1,
      seoText: landing.seoText,
    },
    template: "landing",
    tokens: {
      category: categoryEntity?.title ?? category,
      facet: landing.title,
      count: products.length,
      minPrice: minPrice(products),
    },
    // Условия публикации перепроверяются при каждом рендере: товары могли
    // разобрать уже после публикации — страница остаётся, но уходит из индекса.
    noindex: !isLandingIndexable(landing, availableCount(products)),
  });
}

export default async function LandingPage(
  props: PageProps<"/catalog/[section]/[category]/[facet]">,
) {
  const { section, category, facet } = await props.params;
  const landing = resolve(section, category, facet);

  const products = productsFor(landing);
  const crumbs = landingCrumbs(landing);
  const available = availableCount(products);
  const indexable = isLandingIndexable(landing, available);

  return (
    <div className="container-page py-8">
      <JsonLd data={indexable ? [breadcrumbLd(crumbs), itemListLd(products)] : [breadcrumbLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />

      <h1 className="heading-section mt-4">{landing.h1 || landing.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {available} {plural(available, ["модель", "модели", "моделей"])} в наличии
      </p>

      {products.length === 0 ? (
        <div className="mt-10 rounded-lg border border-line bg-sand p-6">
          <p className="text-sm text-muted">Сейчас в этой подборке нет товаров в наличии.</p>
          <Link href={`/catalog/${section}/${category}`} className="mt-3 inline-block text-sm text-accent hover:underline">
            Посмотреть всю категорию
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
          {products.map((product, index) => (
            <li key={product.id}><ProductCard product={product} eager={index < 4} /></li>
          ))}
        </ul>
      )}

      {landing.seoText && (
        <section
          className="prose-seo mt-16 max-w-3xl border-t border-line pt-8 text-sm leading-relaxed text-muted"
          dangerouslySetInnerHTML={{ __html: landing.seoText }}
        />
      )}

      {!indexable && available > 0 && available < MIN_LANDING_PRODUCTS && (
        <p className="mt-8 rounded border border-line bg-elevated p-3 text-xs text-muted">
          Страница временно закрыта от индексации: товаров в наличии меньше {MIN_LANDING_PRODUCTS}.
        </p>
      )}
    </div>
  );
}
