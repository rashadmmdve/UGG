import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CatalogGrid } from "@/components/shop/CatalogGrid";
import { SALE_SECTION, SECTIONS, SITE_NAME } from "@/lib/constants";
import {
  getCategoriesBySection,
  getColors,
  getSaleProducts,
  getPublishedProducts,
} from "@/server/repositories/catalog";
import { catalogCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, itemListLd } from "@/server/seo/jsonld";

export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: `Каталог обуви UGG® | ${SITE_NAME}` },
  description:
    "Полный каталог обуви UGG®: женские, мужские и детские модели. " +
    "Доставка по России, обмен и возврат 14 дней.",
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  const products = getPublishedProducts();
  const saleCount = getSaleProducts().length;
  const crumbs = catalogCrumbs();

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), itemListLd(products)]} />
      <Breadcrumbs items={crumbs} />

      {/* Фильтры читают адресную строку — нужен Suspense, иначе страница
          перестанет быть статической. */}
      <Suspense fallback={<div className="py-24" aria-hidden />}>
        <CatalogGrid
          header={
            <>
              <h1 className="heading-section">Каталог</h1>
              <nav aria-label="Разделы" className="mt-5 flex flex-wrap gap-2">
                {SECTIONS.map((section) => {
                  const count = getCategoriesBySection(section.slug).length;
                  return (
                    <Link
                      key={section.slug}
                      href={`/catalog/${section.slug}`}
                      className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent"
                    >
                      {section.title} <span className="text-muted">· {count}</span>
                    </Link>
                  );
                })}
                {/* Распродажа считается товарами, а не категориями: их у неё нет. */}
                {saleCount > 0 && (
                  <Link
                    href={`/catalog/${SALE_SECTION.slug}`}
                    className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent"
                  >
                    {SALE_SECTION.title} <span className="text-muted">· {saleCount}</span>
                  </Link>
                )}
              </nav>
            </>
          }
          products={products}
          colors={getColors()}
        />
      </Suspense>
    </div>
  );
}
