import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/shop/ProductCard";
import { searchProducts } from "@/server/repositories/catalog";

/**
 * Результаты поиска из шапки: /search?q=…
 *
 * Страница закрыта от индексации (см. robots.ts): комбинаций запросов
 * бесконечно много, а содержимое каждой уже есть в каталоге.
 */
export const metadata: Metadata = {
  title: "Поиск",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 80);
  const products = query ? searchProducts(query) : [];

  return (
    <div className="container-page py-10">
      <h1 className="heading-section">
        {query ? (
          <>
            Поиск: <span className="font-normal">«{query}»</span>
          </>
        ) : (
          "Поиск"
        )}
      </h1>

      <form action="/search" role="search" className="mt-6 flex max-w-xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Модель, цвет или артикул"
          aria-label="Что ищем"
          autoFocus={!query}
          className="h-11 min-w-0 flex-1 rounded border border-line bg-bg px-4 text-base outline-none focus:border-accent"
        />
        <button type="submit" className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover">
          Найти
        </button>
      </form>

      {query && products.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-xl font-semibold">Ничего не нашлось</p>
          <p className="mt-2 text-sm text-muted">Попробуйте другое слово — например, название модели: Classic Mini, Tasman, Neumel.</p>
          <Link href="/catalog" className="mt-6 inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-medium hover:border-accent">
            В каталог
          </Link>
        </div>
      )}

      {products.length > 0 && (
        <>
          <p className="mt-6 text-sm text-muted">Найдено: {products.length}</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => (
              <li key={product.id}><ProductCard product={product} eager={index < 4} /></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
