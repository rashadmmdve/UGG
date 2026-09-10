"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";

import { useHydrated } from "@/lib/hooks/useHydrated";
import { cartSubtotal, useCartStore } from "@/lib/store/cart";
import { cn, formatPrice, plural } from "@/lib/utils";

export function CartDrawer() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const isOpen = useCartStore((state) => state.isOpen);
  const close = useCartStore((state) => state.close);
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);

  // Переход на другую страницу закрывает шторку.
  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  // До гидрации содержимое корзины неизвестно — она живёт в браузере.
  if (!hydrated) return null;

  const subtotal = cartSubtotal(items);
  const button =
    "inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold transition-colors";

  return (
    /*
      Разметка не размонтируется при закрытии: иначе шторка появлялась бы
      рывком, без выезда сбоку. Видимость выключается через aria-hidden,
      inert и pointer-events.
    */
    <div
      aria-hidden={!isOpen}
      className={cn("fixed inset-0 z-50", !isOpen && "pointer-events-none")}
    >
      <button
        type="button"
        aria-label="Закрыть корзину"
        tabIndex={isOpen ? undefined : -1}
        onClick={close}
        className={cn(
          "absolute inset-0 bg-fg/30 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-label="Корзина"
        inert={!isOpen}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-bg shadow-xl transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <p className="flex items-center gap-2 text-base font-semibold">
            <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
            Корзина{items.length > 0 && ` · ${items.length}`}
          </p>
          <button type="button" onClick={close} aria-label="Закрыть" className="-mr-2 flex h-10 w-10 items-center justify-center">
            <X className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-lg font-semibold">Здесь пока пусто</p>
            <p className="max-w-xs text-sm text-muted">Загляните в каталог — там есть что примерить.</p>
            <Link href="/catalog" onClick={close} className={`${button} mt-2 w-auto border border-line px-6 hover:border-accent`}>
              В каталог
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {items.map((item) => (
                <li key={`${item.productId}-${item.variantId}`} className="flex gap-4 py-4">
                  <Link href={`/product/${item.slug}`} onClick={close} className="relative block h-24 w-24 shrink-0 overflow-hidden rounded bg-elevated">
                    {item.image && <Image src={item.image} alt={item.title} fill sizes="96px" className="object-cover" />}
                  </Link>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <Link href={`/product/${item.slug}`} onClick={close} className="text-sm hover:text-accent">
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">Размер {item.sizeEu}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center rounded border border-line">
                        <button type="button" aria-label="Уменьшить количество"
                          onClick={() => setQuantity(item.productId, item.variantId, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center hover:bg-elevated">
                          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                        <button type="button" aria-label="Увеличить количество"
                          disabled={item.quantity >= item.maxQuantity}
                          onClick={() => setQuantity(item.productId, item.variantId, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center hover:bg-elevated disabled:opacity-30">
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                      <p className="text-sm font-medium tabular-nums">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </div>
                  <button type="button" aria-label={`Удалить ${item.title}`}
                    onClick={() => remove(item.productId, item.variantId)}
                    className="self-start text-muted hover:text-fg">
                    <X className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-5 py-5">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm text-muted">
                  {items.length} {plural(items.length, ["позиция", "позиции", "позиций"])}
                </span>
                <span className="text-xl font-bold tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <p className="mb-4 text-xs text-muted">Доставка рассчитывается при оформлении.</p>
              <Link href="/checkout" onClick={close} className={`${button} bg-accent text-white hover:bg-accent-hover`}>
                Оформить заказ
              </Link>
              <Link href="/cart" onClick={close} className="mt-2 block text-center text-sm text-muted hover:text-accent">
                Перейти в корзину
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
