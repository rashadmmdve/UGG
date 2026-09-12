import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CatalogGrid } from "@/components/shop/CatalogGrid";
import { SALE_SECTION, SITE_NAME } from "@/lib/constants";
import {
  getCategoriesBySection,
  getColors,
  getPublishedProducts,
} from "@/server/repositories/catalog";
import { catalogTiles } from "@/server/catalog/sections";
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

/** Кнопка раздела: форма как у «Фильтров», но чёрная с белой надписью. */
const SECTION_CHIP =
  "inline-flex h-9 w-full items-center justify-center rounded bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover";

export default function CatalogPage() {
  const products = getPublishedProducts();
  // Распродажа из ряда разделов убрана: вместо неё «Новинки».
  const tiles = catalogTiles().filter((tile) => tile.slug !== SALE_SECTION.slug);
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
              {/* Кнопки одной ширины: сетка в равные колонки, а не поток. */}
              <nav aria-label="Разделы" className="mt-5 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
                {tiles.map((section) => {
                  const count = getCategoriesBySection(section.slug).length;
                  return (
                    <Link key={section.slug} href={`/catalog/${section.slug}`} className={SECTION_CHIP}>
                      {section.title}
                      <span className="ml-1 text-white/60">· {count}</span>
                    </Link>
                  );
                })}
                <Link href="/catalog?sort=new" className={SECTION_CHIP}>
                  Новинки
                </Link>
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
