import Image from "next/image";
import Link from "next/link";

import { FavoriteButton } from "@/components/shop/FavoriteButton";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

/**
 * Карточка в сетке каталога.
 *
 * Ссылка — обычный <a href>, а не кнопка с модальным окном, как в
 * исходном шаблоне: у каждого товара свой адрес, и робот должен его обойти.
 */
export function ProductCard({
  product,
  eager = false,
}: {
  product: Product;
  /** Первые карточки на экране грузятся сразу. */
  eager?: boolean;
}) {
  const inStock = product.variants.some((variant) => variant.stock > 0);
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
  const image = product.images[0];

  return (
    <article className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-elevated">
          {image ? (
            <Image
              src={image}
              alt={product.title}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading={eager ? "eager" : "lazy"}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Фото скоро
            </div>
          )}

          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <span className="rounded bg-sale px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white">
                −{discount}%
              </span>
            )}
            {!inStock && (
              <span className="rounded bg-fg/80 px-1.5 py-0.5 text-[0.6875rem] font-medium text-white">
                Нет в наличии
              </span>
            )}
          </div>
        </div>

        <h3 className="mt-3 line-clamp-2 text-sm leading-snug group-hover:text-accent">
          {product.title}
        </h3>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold">{formatPrice(product.price)}</span>
          {discount > 0 && product.oldPrice && (
            <span className="text-xs text-muted line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </p>
      </Link>

      <FavoriteButton
        productId={product.id}
        className="absolute top-1 right-1 rounded-full bg-bg/80 backdrop-blur-sm"
      />
    </article>
  );
}
