import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CatalogGrid } from "@/components/shop/CatalogGrid";
import { SECTIONS } from "@/lib/constants";
import {
  getCategoriesBySection,
  getColors,
  getProductsByCategory,
  getProductsBySection,
} from "@/server/repositories/catalog";
import { sectionCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, itemListLd } from "@/server/seo/jsonld";
import { buildMetadata, minPrice } from "@/server/seo/meta";

export const revalidate = 600;

/** Разделов ровно четыре, они заданы константой: это часть структуры адресов. */
export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section: section.slug }));
}

function findSection(slug: string) {
  return SECTIONS.find((section) => section.slug === slug) ?? null;
}

export async function generateMetadata(
  props: PageProps<"/catalog/[section]">,
): Promise<Metadata> {
  const { section: sectionSlug } = await props.params;
  const section = findSection(sectionSlug);
  if (!section) return {};

  const products = getProductsBySection(sectionSlug);
  return buildMetadata({
    path: `/catalog/${sectionSlug}`,
    template: "category",
    tokens: { category: `${section.title} UGG`, count: products.length, minPrice: minPrice(products) },
  });
}

export default async function SectionPage(props: PageProps<"/catalog/[section]">) {
  const { section: sectionSlug } = await props.params;
  const section = findSection(sectionSlug);
  if (!section) notFound();

  const products = getProductsBySection(sectionSlug);
  const crumbs = sectionCrumbs(sectionSlug);

  // Категории раздела уходят в боковую панель рядом с цветом и размером.
  const categoryLinks = getCategoriesBySection(sectionSlug).map((category) => ({
    title: category.shortTitle ?? category.title,
    href: `/catalog/${sectionSlug}/${category.slug}`,
    count: getProductsByCategory(category.id).length,
    active: false,
  }));

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), itemListLd(products)]} />
      <Breadcrumbs items={crumbs} />

      <h1 className="heading-section mt-4">{section.title} UGG</h1>

      {products.length === 0 ? (
        <p className="mt-10 rounded-lg border border-line bg-sand p-6 text-sm text-muted">
          В этом разделе пока нет товаров.
        </p>
      ) : (
        <Suspense fallback={<div className="py-24" aria-hidden />}>
          <CatalogGrid
            products={products}
            colors={getColors()}
            categories={categoryLinks}
          />
        </Suspense>
      )}
    </div>
  );
}
