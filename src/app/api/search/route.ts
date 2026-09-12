import { NextResponse } from "next/server";

import { searchProducts } from "@/server/repositories/catalog";

/**
 * Живой поиск из шапки: GET /api/search?q=… → короткий список товаров.
 *
 * Отдаёт только то, что нужно подсказке: название, адрес, цену и первое
 * фото. Полная выдача — на странице /search.
 */
export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ items: [] });

  const items = searchProducts(q)
    .slice(0, 8)
    .map((product) => ({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price,
      image: product.images[0] ?? null,
    }));
  return NextResponse.json({ items, total: searchProducts(q).length });
}
