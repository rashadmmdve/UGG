"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { useCartStore } from "@/lib/store/cart";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * «В корзину» прямо из плитки каталога.
 *
 * У обуви без размера в корзину не положишь, поэтому кнопка сначала
 * раскрывает ряд доступных размеров и только по выбору добавляет товар.
 * Там, где размера нет вовсе (аксессуары), добавляет сразу.
 */
export function CardAddToCart({ product }: { product: Product }) {
  const add = useCartStore((state) => state.add);
  const [pickingSize, setPickingSize] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const available = product.variants.filter((variant) => variant.stock > 0);
  const sizeless = product.variants.length === 1 && product.variants[0].sizeEu === 0;

  if (available.length === 0) {
    return (
      <button type="button" disabled className="h-10 w-full rounded-md bg-line-strong text-sm font-semibold text-white">
        Нет в наличии
      </button>
    );
  }

  function addVariant(variant: (typeof available)[number]) {
    add({
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      slug: product.slug,
      sizeEu: variant.sizeEu,
      image: product.images[0] ?? null,
      price: product.price,
      quantity: 1,
      maxQuantity: variant.stock,
    });
    setPickingSize(false);
    // Две секунды кнопка зелёная и не нажимается — как в карточке товара.
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2000);
  }

  if (pickingSize) {
    return (
      <div>
        <div className="flex flex-wrap gap-1">
          {available.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => addVariant(variant)}
              className="h-9 min-w-9 rounded border border-line px-2 text-xs font-medium hover:border-accent"
            >
              {variant.sizeEu}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPickingSize(false)}
          className="mt-1 text-xs text-muted hover:text-fg"
        >
          Отмена
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={added}
      onClick={() => (sizeless ? addVariant(available[0]) : setPickingSize(true))}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-white transition-colors",
        added ? "bg-accent disabled:bg-accent" : "bg-accent hover:bg-accent-hover",
      )}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2} /> В корзине
        </>
      ) : (
        "В корзину"
      )}
    </button>
  );
}
