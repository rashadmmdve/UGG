import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CatalogGrid } from "@/components/shop/CatalogGrid";
import { SECTIONS, SITE_NAME } from "@/lib/constants";
import {
  getCategoriesBySection,
  getColors,
  getPublishedProducts,
} from "@/server/repositories/catalog";
import { catalogCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, itemListLd } from "@/server/seo/jsonld";

export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: `Каталог обуви UGG® | ${SITE_NAME}` },
  description:
    "Полный каталог обуви UGG®: женские, мужские и детские модели, " +
    "аксессуары. Доставка по России, обмен и возврат 14 дней.",
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  const products = getPublishedProducts();
  const crumbs = catalogCrumbs();

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), itemListLd(products)]} />
      <Breadcrumbs items={crumbs} />

      <h1 className="heading-section mt-4">Каталог</h1>

      <nav aria-label="Разделы" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((section) => {
          const count = getCategoriesBySection(section.slug).length;
          return (
            <Link
              key={section.slug}
              href={`/catalog/${section.slug}`}
              className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-accent"
            >
              {section.title} <span className="text-muted">· {count}</span>
            </Link>
          );
        })}
      </nav>

      {/* Фильтры читают адресную строку — нужен Suspense, иначе страница
          перестанет быть статической. */}
      <Suspense fallback={<div className="py-24" aria-hidden />}>
        <CatalogGrid products={products} colors={getColors()} />
      </Suspense>
    </div>
  );
}
