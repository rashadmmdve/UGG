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
        {/*
          object-contain, а не cover: снимок вписывается в плитку целиком и
          встаёт по центру. Обрезка выглядела бы аккуратнее, но у обуви она
          режет то носок, то голенище — а фотографии приходят от разных
          поставщиков и в разных пропорциях.
        */}
        {/* Плитка 3:4 белая, фото по центру, а сверху — почти прозрачная
            серая вуаль. Она ложится и на фото, и на поля: у снимков фон
            белый, и без неё внутри плитки виднелся бы белый квадрат. */}
        <div className="relative aspect-[3/4] overflow-hidden bg-white">
          {image ? (
            <Image
              src={image}
              alt={product.title}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
              className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              loading={eager ? "eager" : "lazy"}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Фото скоро
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-fg/[0.06]" aria-hidden />

          {/* Процент скидки на плитке не рисуем — он виден по зачёркнутой
              цене под ней. Остаётся только предупреждение об остатке. */}
          {!inStock && (
            <span className="absolute top-2 left-2 rounded bg-fg/80 px-1.5 py-0.5 text-[0.6875rem] font-medium text-white">
              Нет в наличии
            </span>
          )}
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

      <FavoriteButton productId={product.id} className="absolute top-0.5 right-0.5" iconClassName="h-4 w-4" />
    </article>
  );
}
