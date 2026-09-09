import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { formatPrice } from "@/lib/utils";
import {
  getColorById,
  getModelLineById,
  getProductBySlug,
  getProductsByGroup,
  getPublishedProducts,
  getSizeChartById,
} from "@/server/repositories/catalog";
import { getApprovedReviews } from "@/server/repositories/reviews";
import { productCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, productLd } from "@/server/seo/jsonld";
import { buildMetadata } from "@/server/seo/meta";
import { MATERIAL_TITLES } from "@/server/catalog/facets";

export const revalidate = 600;

export function generateStaticParams() {
  return getPublishedProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(
  props: PageProps<"/product/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);

  if (!product || !product.isPublished) return {};

  return buildMetadata({
    /**
     * Адрес карточки не зависит от того, из какой категории пришёл
     * покупатель: у товара один канонический адрес, иначе одна и та же
     * пара обуви размножилась бы по индексу в нескольких вариантах.
     */
    path: `/product/${product.slug}`,
    seo: product.seo,
    template: "product",
    tokens: { title: product.title, price: product.price },
    images: product.images.slice(0, 1),
  });
}

export default async function ProductPage(props: PageProps<"/product/[slug]">) {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);

  if (!product || !product.isPublished) notFound();

  const reviews = getApprovedReviews(product.id);
  const color = product.colorId ? getColorById(product.colorId) : null;
  const modelLine = product.modelLineId
    ? getModelLineById(product.modelLineId)
    : null;
  const sizeChart = modelLine?.sizeChartId
    ? getSizeChartById(modelLine.sizeChartId)
    : null;
  const otherColors = product.groupId
    ? getProductsByGroup(product.groupId, product.id)
    : [];

  const crumbs = productCrumbs(product);
  const available = product.variants.filter((variant) => variant.stock > 0);

  return (
    <main className="container-page mx-auto max-w-6xl py-10">
      <JsonLd data={[breadcrumbLd(crumbs), productLd(product, reviews)]} />

      <Breadcrumbs items={crumbs} />

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Галерея */}
        <div className="grid grid-cols-2 gap-3">
          {product.images.length > 0 ? (
            product.images.map((image, index) => (
              <div
                key={image}
                className="relative aspect-square overflow-hidden rounded-lg bg-elevated"
              >
                <Image
                  src={image}
                  alt={`${product.title} — фото ${index + 1}`}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                  // Первое фото — самый крупный элемент экрана, грузим сразу.
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))
          ) : (
            <div className="col-span-2 flex aspect-[4/3] items-center justify-center rounded-lg bg-elevated text-muted">
              Фотографии не загружены
            </div>
          )}
        </div>

        {/* Описание и покупка */}
        <div>
          <h1 className="heading-section">{product.seo.h1 || product.title}</h1>

          {product.sku && (
            <p className="mt-2 text-sm text-muted">Артикул: {product.sku}</p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-2xl font-bold">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="text-lg text-muted line-through">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>

          {color && (
            <p className="mt-4 text-sm">
              Цвет: <span className="font-medium">{color.title}</span>
            </p>
          )}

          {/* Размеры */}
          <div className="mt-6">
            <p className="label-caps">Размер</p>
            {available.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {available.map((variant) => (
                  <li
                    key={variant.id}
                    className="rounded border border-line px-3 py-1.5 text-sm"
                  >
                    {variant.sizeEu}
                    {variant.insoleCm && (
                      <span className="ml-1 text-muted">
                        · {variant.insoleCm} см
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted">Нет в наличии</p>
            )}
          </div>

          {sizeChart && (
            <details className="mt-6 rounded-lg border border-line p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {sizeChart.title}
              </summary>
              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="pb-2 font-normal">EU</th>
                    <th className="pb-2 font-normal">US</th>
                    <th className="pb-2 font-normal">UK</th>
                    <th className="pb-2 font-normal">Стелька</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeChart.rows.map((row) => (
                    <tr key={row.sizeEu} className="border-t border-line">
                      <td className="py-1.5">{row.sizeEu}</td>
                      <td className="py-1.5">{row.sizeUs ?? "—"}</td>
                      <td className="py-1.5">{row.sizeUk ?? "—"}</td>
                      <td className="py-1.5">{row.insoleCm} см</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {product.description && (
            <div className="mt-8 text-sm leading-relaxed">
              {product.description}
            </div>
          )}

          {(product.materials.length > 0 || product.shaftHeightCm) && (
            <dl className="mt-8 space-y-1 text-sm">
              {product.materials.length > 0 && (
                <div className="flex gap-2">
                  <dt className="text-muted">Материал:</dt>
                  <dd>
                    {product.materials
                      .map((material) => MATERIAL_TITLES[material])
                      .join(", ")}
                  </dd>
                </div>
              )}
              {product.shaftHeightCm && (
                <div className="flex gap-2">
                  <dt className="text-muted">Высота голенища:</dt>
                  <dd>{product.shaftHeightCm} см</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Другие цвета этой модели — и удобство, и внутренняя перелинковка */}
      {otherColors.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">Другие цвета</h2>
          <ul className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {otherColors.map((item) => (
              <li key={item.id}>
                <Link href={`/product/${item.slug}`} className="group block">
                  <span className="block text-sm group-hover:text-accent">
                    {item.title}
                  </span>
                  <span className="mt-1 block font-semibold">
                    {formatPrice(item.price)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">Отзывы</h2>
          <ul className="mt-4 space-y-6">
            {reviews.map((review) => (
              <li key={review.id} className="border-t border-line pt-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium">{review.authorName}</span>
                  <span className="text-sm text-muted">
                    {review.rating} из 5
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{review.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
