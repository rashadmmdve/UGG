import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CatalogGrid } from "@/components/shop/CatalogGrid";
import { SALE_SECTION } from "@/lib/constants";
import { getColors, getSaleProducts } from "@/server/repositories/catalog";
import { sectionCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, itemListLd } from "@/server/seo/jsonld";
import { buildMetadata, minPrice } from "@/server/seo/meta";

export const revalidate = 600;

/**
 * Распродажа.
 *
 * Отдельный маршрут, а не ещё один /catalog/[section]: там каждый раздел
 * задаёт пол товара и тянет за собой свои категории, а распродажа —
 * ручная подборка поверх женского и мужского. Статический сегмент имеет
 * приоритет над динамическим, поэтому адрес перехватывается здесь.
 *
 * Категорий у раздела нет: в боковой панели остаются цвет, размер и
 * материал — они считаются от самой подборки.
 */
export async function generateMetadata(): Promise<Metadata> {
  const products = getSaleProducts();

  // Пустую подборку индексировать нельзя: страница «здесь ничего нет»
  // в выдаче хуже, чем её отсутствие.
  if (products.length === 0) {
    return {
      title: SALE_SECTION.title,
      alternates: { canonical: `/catalog/${SALE_SECTION.slug}` },
      robots: { index: false, follow: true },
    };
  }

  return buildMetadata({
    path: `/catalog/${SALE_SECTION.slug}`,
    template: "category",
    tokens: {
      category: "Распродажа UGG",
      count: products.length,
      minPrice: minPrice(products),
    },
  });
}

export default function SalePage() {
  const products = getSaleProducts();
  const crumbs = sectionCrumbs(SALE_SECTION.slug);

  const header = (
    <>
      <h1 className="heading-section">{SALE_SECTION.title}</h1>
      {products.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Женские и мужские модели по сниженным ценам. Размеры разбирают быстро.
        </p>
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
            Распродажа готовится — скоро здесь появятся модели со скидкой.
          </p>
        </>
      ) : (
        <Suspense fallback={<div className="py-24" aria-hidden />}>
          <CatalogGrid header={header} products={products} colors={getColors()} />
        </Suspense>
      )}
    </div>
  );
}
