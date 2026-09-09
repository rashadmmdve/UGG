"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  variantId: string;
  title: string;
  slug: string;
  sizeEu: number;
  image: string | null;
  /** Цена на момент добавления — итог всё равно пересчитывается на сервере. */
  price: number;
  quantity: number;
  maxQuantity: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  add: (item: CartItem) => void;
  remove: (productId: string, variantId: string) => void;
  setQuantity: (productId: string, variantId: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

function sameLine(item: CartItem, productId: string, variantId: string) {
  return item.productId === productId && item.variantId === variantId;
}

/**
 * Корзина живёт в браузере и на сервер уходит только при оформлении —
 * идентификаторами и количеством. Цены и остатки сервер берёт из каталога.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,

      add: (item) =>
        set((state) => {
          const existing = state.items.find((candidate) =>
            sameLine(candidate, item.productId, item.variantId),
          );

          // Шторку намеренно не открываем: она перекрывает карточку, и
          // покупатель теряет место. Подтверждение даёт сама кнопка.
          if (!existing) {
            return { items: [...state.items, item] };
          }

          return {
            items: state.items.map((candidate) =>
              sameLine(candidate, item.productId, item.variantId)
                ? {
                    ...candidate,
                    quantity: Math.min(
                      candidate.quantity + item.quantity,
                      candidate.maxQuantity,
                    ),
                  }
                : candidate,
            ),
          };
        }),

      remove: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter((item) => !sameLine(item, productId, variantId)),
        })),

      setQuantity: (productId, variantId, quantity) =>
        set((state) => ({
          items: state.items.flatMap((item) => {
            if (!sameLine(item, productId, variantId)) return item;
            if (quantity < 1) return [];
            return { ...item, quantity: Math.min(quantity, item.maxQuantity) };
          }),
        })),

      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: "ugg-cart",
      // Флаг открытой шторки не должен переживать перезагрузку страницы.
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
