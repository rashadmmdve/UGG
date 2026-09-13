"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { useCartStore } from "@/lib/store/cart";
import type { Product, ProductVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * «В корзину» прямо из плитки каталога.
 *
 * У обуви без размера в корзину не положишь, поэтому кнопка сначала
 * раскрывает ряд доступных размеров и только по выбору добавляет товар.
 * Там, где размера нет вовсе (аксессуары), добавляет сразу.
 *
 * Размеры всплывают поверх названия и цены, а не встают в поток: иначе
 * карточка вырастала бы и сетка каталога прыгала.
 */
export function CardAddToCart({ product }: { product: Product }) {
  const add = useCartStore((state) => state.add);
  const [pickingSize, setPickingSize] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Клик мимо или Escape закрывают ряд размеров.
  useEffect(() => {
    if (!pickingSize) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setPickingSize(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickingSize(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pickingSize]);

  const available = product.variants.filter((variant) => variant.stock > 0);
  const sizeless = product.variants.length === 1 && product.variants[0].sizeEu === 0;

  if (available.length === 0) {
    return (
      <button type="button" disabled className="h-10 w-full bg-line-strong text-sm font-semibold text-white">
        Нет в наличии
      </button>
    );
  }

  function addVariant(variant: ProductVariant) {
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
    // Две секунды кнопка не нажимается, чтобы не удвоить количество.
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={added}
        onClick={() => (sizeless ? addVariant(available[0]) : setPickingSize((v) => !v))}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center gap-1.5 bg-accent text-sm font-semibold text-white transition-colors",
          added ? "disabled:bg-accent" : "hover:bg-accent-hover",
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

      {/* Ряд размеров встаёт над кнопкой, закрывая название и цену.
          Кнопка при этом не сдвигается, а карточка не растёт. */}
      {pickingSize && (
        <div className="absolute inset-x-0 bottom-full z-20 flex min-h-[5.25rem] flex-col justify-center bg-bg pt-1.5 pb-2">
          <p className="mb-1.5 text-center text-[0.6875rem] text-muted">Выберите размер</p>
          <div className="flex flex-wrap justify-center gap-1">
            {available.map((variant) => {
              // Под размером — US и длина стельки, как в карточке товара.
              const note = [variant.sizeUs && `US ${variant.sizeUs}`, variant.insoleCm && `${variant.insoleCm} см`]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => addVariant(variant)}
                  className="min-w-9 rounded border border-line px-1.5 py-1 text-center text-xs font-medium hover:border-accent"
                >
                  <span className="block leading-tight">{variant.sizeEu}</span>
                  {note && <span className="block text-[9px] leading-tight font-normal text-muted">{note}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
