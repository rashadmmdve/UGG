"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";

import { useHydrated } from "@/lib/hooks/useHydrated";
import { cartSubtotal, useCartStore } from "@/lib/store/cart";
import { formatPrice, plural } from "@/lib/utils";

export function CartView() {
  const hydrated = useHydrated();
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);

  if (!hydrated) return <div className="py-24" aria-hidden />;

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-xl font-semibold">Корзина пуста</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Выберите что-нибудь в каталоге.</p>
        <Link href="/catalog" className="mt-6 inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-medium hover:border-accent">
          В каталог
        </Link>
      </div>
    );
  }

  const subtotal = cartSubtotal(items);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-12">
      <ul className="divide-y divide-line border-y border-line lg:col-span-8">
        {items.map((item) => (
          <li key={`${item.productId}-${item.variantId}`} className="flex gap-4 py-5 md:gap-6">
            <Link href={`/product/${item.slug}`} className="relative block h-28 w-28 shrink-0 overflow-hidden rounded bg-white md:h-36 md:w-36">
              {item.image && <Image src={item.image} alt={item.title} fill sizes="144px" className="object-contain" />}
            </Link>
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/product/${item.slug}`} className="text-sm hover:text-accent md:text-base">{item.title}</Link>
                  <p className="mt-1 text-xs text-muted">Размер {item.sizeEu}</p>
                </div>
                <button type="button" aria-label={`Удалить ${item.title}`}
                  onClick={() => remove(item.productId, item.variantId)} className="text-muted hover:text-fg">
                  <X className="h-4 w-4" strokeWidth={1.6} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center rounded border border-line">
                  <button type="button" aria-label="Уменьшить количество"
                    onClick={() => setQuantity(item.productId, item.variantId, item.quantity - 1)}
                    className="flex h-9 w-9 items-center justify-center hover:bg-elevated">
                    <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <span className="w-10 text-center text-sm tabular-nums">{item.quantity}</span>
                  <button type="button" aria-label="Увеличить количество"
                    disabled={item.quantity >= item.maxQuantity}
                    onClick={() => setQuantity(item.productId, item.variantId, item.quantity + 1)}
                    className="flex h-9 w-9 items-center justify-center hover:bg-elevated disabled:opacity-30">
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
                <p className="font-medium tabular-nums md:text-lg">{formatPrice(item.price * item.quantity)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="lg:col-span-4">
        <div className="rounded-lg border border-line p-6">
          <h2 className="label-caps">Итого</h2>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-muted">{items.length} {plural(items.length, ["позиция", "позиции", "позиций"])}</span>
            <span className="text-2xl font-bold tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-3 text-xs text-muted">Доставка рассчитывается на следующем шаге по вашему адресу.</p>
          <Link href="/checkout" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-md bg-accent text-sm font-semibold text-white hover:bg-accent-hover">
            Оформить заказ
          </Link>
          <p className="mt-3 text-xs text-muted">Промокод можно применить при оформлении.</p>
        </div>
      </aside>
    </div>
  );
}
