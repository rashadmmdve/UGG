"use client";

import Link from "next/link";

import { ProductCard } from "@/components/shop/ProductCard";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useFavoritesStore } from "@/lib/store/favorites";
import type { Product } from "@/lib/types";

/**
 * Избранное хранится в браузере — сервер отдаёт все опубликованные товары,
 * а отбор по сохранённым идентификаторам делается уже здесь.
 */
export function FavoritesList({ products }: { products: Product[] }) {
  const hydrated = useHydrated();
  const ids = useFavoritesStore((state) => state.ids);

  if (!hydrated) return <div className="py-24" aria-hidden />;

  const favorites = products.filter((product) => ids.includes(product.id));

  if (favorites.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-xl font-semibold">В избранном пусто</p>
        <p className="mt-2 text-sm text-muted">Нажмите на сердечко у товара — он появится здесь.</p>
        <Link href="/catalog" className="mt-6 inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-medium hover:border-accent">
          В каталог
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {favorites.map((product) => (
        <li key={product.id}><ProductCard product={product} /></li>
      ))}
    </ul>
  );
}
