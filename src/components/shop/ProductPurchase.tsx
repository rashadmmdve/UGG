"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { useCartStore } from "@/lib/store/cart";
import { cn, formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

/**
 * Выбор размера и добавление в корзину.
 *
 * На мобильном кнопка залипает внизу экрана — иначе на длинной карточке
 * до неё нужно скроллить. Подтверждение добавления — сама кнопка зеленеет;
 * шторка корзины не открывается, чтобы не перекрывать карточку.
 */
export function ProductPurchase({ product }: { product: Product }) {
  const add = useCartStore((state) => state.add);

  const available = product.variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState<string | null>(
    available.length === 1 ? available[0].id : null,
  );
  const [error, setError] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
  }, []);

  const variant = product.variants.find((item) => item.id === variantId);
  const inStock = available.length > 0;
  // Безразмерный товар: единственный вариант с нулевым размером. Выбор
  // размера у него не показываем — выбирать не из чего.
  const sizeless = product.variants.length === 1 && product.variants[0].sizeEu === 0;

  function handleAdd() {
    if (!variant) {
      setError(true);
      return;
    }

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

    // Две секунды кнопка зелёная и не нажимается: видно, что добавилось,
    // и второй тап сгоряча не удвоит количество.
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 2000);
  }

  const buttonClass = cn(
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed",
    added ? "bg-success disabled:bg-success" : "bg-accent hover:bg-accent-hover disabled:bg-line-strong",
  );

  const label = !inStock ? (
    "Нет в наличии"
  ) : added ? (
    <>
      <Check className="h-4 w-4" strokeWidth={2} /> В корзине
    </>
  ) : (
    `В корзину · ${formatPrice(product.price)}`
  );

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(sizeless && "hidden")}>
        <p className="label-caps mb-2">Размер EU</p>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((item) => {
            const disabled = item.stock === 0;
            const selected = item.id === variantId;
            // Под европейским размером — US и стелька, как у производителя:
            // «36 (US 5 — 22 см)». Покупатель сверяет со своей парой.
            const note = [item.sizeUs && `US ${item.sizeUs}`, item.insoleCm && `${item.insoleCm} см`]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                title={item.insoleCm ? `Стелька ${item.insoleCm} см` : undefined}
                onClick={() => {
                  setVariantId(item.id);
                  setError(false);
                }}
                className={cn(
                  // Фиксированная ширина: все кнопки одинаковые, подпись по центру.
                  "min-h-12 w-[92px] rounded-md border px-1 py-2 text-center text-sm font-medium transition-colors",
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-line text-fg hover:border-accent",
                  disabled && "cursor-not-allowed border-line/60 text-line-strong line-through hover:border-line/60",
                )}
              >
                <span className="block leading-tight">{item.sizeEu}</span>
                {note && (
                  <span className={cn("mt-0.5 block text-[11px] font-normal leading-tight", selected ? "text-white/80" : "text-muted")}>
                    {note}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-danger">
            Выберите размер
          </p>
        )}
        {variant && variant.insoleCm && (
          <p className="mt-3 text-xs text-muted">Длина стельки {variant.insoleCm} см</p>
        )}
        {variant && variant.stock <= 3 && (
          <p className="mt-1 text-xs text-muted">Осталось {variant.stock} шт.</p>
        )}
      </div>

      {/* На широком экране кнопка занимает треть колонки: во всю ширину
          она перетягивала на себя весь блок покупки. */}
      <div className="hidden md:block md:w-1/3">
        <button type="button" className={buttonClass} disabled={!inStock || added} onClick={handleAdd}>
          {label}
        </button>
      </div>

      {/* Залипающая панель покупки на мобильном */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 p-3 backdrop-blur-sm md:hidden">
        <button type="button" className={buttonClass} disabled={!inStock || added} onClick={handleAdd}>
          {label}
        </button>
      </div>
    </div>
  );
}
