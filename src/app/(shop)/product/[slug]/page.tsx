import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductPurchase } from "@/components/shop/ProductPurchase";
import { cn, formatPrice } from "@/lib/utils";
import { MATERIAL_TITLES } from "@/server/catalog/facets";
import {
  getColorById,
  getModelLineById,
  getProductBySlug,
  getProductsByCategory,
  getProductsByGroup,
  getPublishedProducts,
} from "@/server/repositories/catalog";
import { getApprovedReviews } from "@/server/repositories/reviews";
import { productCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, productLd } from "@/server/seo/jsonld";
import { buildMetadata } from "@/server/seo/meta";

export const revalidate = 600;

export function generateStaticParams() {
  return getPublishedProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata(props: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product || !product.isPublished) return {};

  return buildMetadata({
    // У карточки один канонический адрес независимо от того, из какой
    // категории пришёл покупатель.
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
  const modelLine = product.modelLineId ? getModelLineById(product.modelLineId) : null;
  // Весь цветовой ряд модели, включая текущий товар: в блоке «Другие цвета»
  // показываются все варианты, текущий — подсвеченным.
  const colorways = product.groupId ? getProductsByGroup(product.groupId) : [];
  const otherColors = colorways.filter((item) => item.id !== product.id);
  const similar = product.primaryCategoryId
    ? getProductsByCategory(product.primaryCategoryId)
        .filter((item) => item.id !== product.id && !otherColors.some((o) => o.id === item.id))
        .slice(0, 4)
    : [];

  const crumbs = productCrumbs(product);
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), productLd(product, reviews)]} />
      <Breadcrumbs items={crumbs} />

      {/* Галерее отведено меньше половины ширины: в квадрате на пол-экрана
          обувь выглядела непропорционально крупной. */}
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ProductGallery images={product.images} title={product.title} productId={product.id} />

        <div className="lg:pl-4">
          {modelLine && <p className="label-caps">{modelLine.title}</p>}
          <h1 className="heading-section mt-1">{product.seo.h1 || product.title}</h1>
          {product.sku && <p className="mt-2 text-xs text-muted">Артикул {product.sku}</p>}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
            {discount > 0 && product.oldPrice && (
              <>
                <span className="text-muted line-through">{formatPrice(product.oldPrice)}</span>
                <span className="rounded bg-sale px-1.5 py-0.5 text-xs font-semibold text-white">−{discount}%</span>
              </>
            )}
          </div>

          {color && (
            <p className="mt-4 flex items-center gap-2 text-sm">
              <span className="h-4 w-4 rounded-full border border-line" style={{ backgroundColor: color.hex }} aria-hidden />
              Цвет: <span className="font-medium">{color.title}</span>
            </p>
          )}

          {/*
            Другие цвета этой модели — миниатюрами, а не кружками краски.
            Цветовое пятно не передаёт, как оттенок выглядит на самой обуви:
            «Chestnut» и «Hickory» рядом почти неразличимы, а на фото
            разница очевидна. Текущий цвет показан здесь же и подсвечен,
            чтобы был виден весь ряд, а не только альтернативы.
          */}
          {colorways.length > 1 && (
            <div className="mt-4">
              <p className="text-xs text-muted">Другие цвета</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {colorways.map((item) => {
                  const itemColor = item.colorId ? getColorById(item.colorId) : null;
                  const current = item.id === product.id;
                  const image = item.images[0];

                  return (
                    <li key={item.id}>
                      <Link
                        href={`/product/${item.slug}`}
                        title={itemColor ? `${item.title} — ${itemColor.title}` : item.title}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "relative block h-16 w-16 overflow-hidden rounded-md border bg-elevated transition-colors",
                          current ? "border-fg" : "border-line hover:border-fg",
                        )}
                      >
                        {image ? (
                          <Image
                            src={image}
                            alt={itemColor?.title ?? item.title}
                            fill
                            sizes="64px"
                            className="object-contain"
                          />
                        ) : (
                          // Фото ещё не загрузили — показываем сам оттенок,
                          // иначе ряд выглядел бы набором пустых рамок.
                          <span
                            className="block h-full w-full"
                            style={{ backgroundColor: itemColor?.hex ?? "#ddd" }}
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <ProductPurchase product={product} />
          </div>

          {/* Характеристики под кнопкой — свёрнутым блоком, как раньше
              размерная сетка: кому нужно, раскроет. */}
          {product.specs.length > 0 && (
            <details className="mt-6 rounded-lg border border-line p-4">
              <summary className="cursor-pointer text-sm font-medium">Описание товара</summary>
              <dl className="mt-3 grid gap-y-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-6">
                {product.specs.map((spec) => (
                  <div key={spec.label} className="contents">
                    <dt className="text-muted">{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}


          {product.description && (
            <div className="mt-8 text-sm leading-relaxed">{product.description}</div>
          )}

          <dl className="mt-6 grid gap-1 text-sm sm:grid-cols-2">
            {product.materials.length > 0 && (
              <div><dt className="text-xs text-muted">Материал</dt><dd>{product.materials.map((m) => MATERIAL_TITLES[m]).join(", ")}</dd></div>
            )}
            {product.shaftHeightCm && (
              <div><dt className="text-xs text-muted">Высота голенища</dt><dd>{product.shaftHeightCm} см</dd></div>
            )}
            {product.heelHeightCm && (
              <div><dt className="text-xs text-muted">Высота каблука</dt><dd>{product.heelHeightCm} см</dd></div>
            )}
          </dl>
        </div>
      </div>

      {reviews.length > 0 && (
        <section className="mt-16 max-w-3xl">
          <h2 className="text-xl font-bold">Отзывы</h2>
          <ul className="mt-4 space-y-5">
            {reviews.map((review) => (
              <li key={review.id} className="border-t border-line pt-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-medium">{review.authorName}</span>
                  <span className="text-accent" aria-label={`Оценка ${review.rating} из 5`}>{"★".repeat(review.rating)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{review.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">Похожие модели</h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {similar.map((item) => (
              <li key={item.id}><ProductCard product={item} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
