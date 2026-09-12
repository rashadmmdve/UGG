import Link from "next/link";
import { Fragment } from "react";

import { BulkCheckbox, BulkPublishBar } from "@/components/admin/BulkPublish";
import { formatPrice } from "@/lib/utils";
import { getCategoryById, getProducts } from "@/server/repositories/catalog";
import type { Product } from "@/lib/types";

const GENDER_TITLE: Record<string, string> = { women: "Женские", men: "Мужские", kids: "Детские" };
const GENDER_ORDER = ["women", "men", "kids"];

/**
 * Группы «пол → категория» в порядке разделов; внутри категории — как
 * пришли из базы (новые первыми). Без категории — в конец раздела.
 */
function groupProducts(products: Product[]) {
  const byGender = new Map<string, Map<string, Product[]>>();
  for (const product of products) {
    const gender = product.gender;
    const category = product.primaryCategoryId ? getCategoryById(product.primaryCategoryId)?.title ?? "Без категории" : "Без категории";
    const categories = byGender.get(gender) ?? new Map<string, Product[]>();
    categories.set(category, [...(categories.get(category) ?? []), product]);
    byGender.set(gender, categories);
  }
  const genders = [...byGender.keys()].sort((a, b) => (GENDER_ORDER.indexOf(a) + 99) % 99 - (GENDER_ORDER.indexOf(b) + 99) % 99);
  return genders.map((gender) => ({
    gender,
    title: GENDER_TITLE[gender] ?? gender,
    categories: [...byGender.get(gender)!.entries()]
      .sort((a, b) => (a[0] === "Без категории" ? 1 : b[0] === "Без категории" ? -1 : a[0].localeCompare(b[0], "ru")))
      .map(([title, items]) => ({ title, items })),
  }));
}

export default async function AdminProductsPage(
  props: PageProps<"/admin/products">,
) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";

  const products = getProducts().filter((product) =>
    query
      ? product.title.toLowerCase().includes(query) ||
        (product.sku ?? "").toLowerCase().includes(query) ||
        product.slug.includes(query)
      : true,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Товары <span className="text-base font-normal text-muted">{products.length}</span>
        </h1>
        <Link
          href="/admin/products/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новый товар
        </Link>
      </div>

      <form className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Поиск по названию, артикулу, адресу"
          className="w-full max-w-md rounded border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </form>

      {products.length > 0 && <BulkPublishBar total={products.length} />}

      {products.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {query ? "Ничего не найдено." : "Товаров пока нет — создайте первый."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-4 py-2 font-normal">Название</th>
                <th className="px-4 py-2 font-normal">Артикул</th>
                <th className="px-4 py-2 font-normal text-right">Цена</th>
                <th className="px-4 py-2 font-normal text-right">Остаток</th>
                <th className="px-4 py-2 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {groupProducts(products).map((group) => group.categories.map((category, index) => (
                <Fragment key={`${group.gender}-${category.title}`}>
                  {/* Заголовок раздела — перед первой категорией, категория — перед своими товарами. */}
                  {index === 0 && (
                    <tr className="bg-sand">
                      <td colSpan={6} className="px-4 py-2 text-sm font-bold">
                        {group.title}{" "}
                        <span className="font-normal text-muted">{group.categories.reduce((n, c) => n + c.items.length, 0)}</span>
                      </td>
                    </tr>
                  )}
                  <tr className="bg-elevated">
                    <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                      {category.title} <span className="font-normal">{category.items.length}</span>
                    </td>
                  </tr>
                  {category.items.map((product) => {
                const stock = product.variants.reduce((sum, v) => sum + v.stock, 0);

                return (
                  <tr key={product.id} className="hover:bg-sand">
                    <td className="px-3 py-2"><BulkCheckbox id={product.id} /></td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:text-accent"
                      >
                        {product.title}
                      </Link>
                      <span className="block text-xs text-muted">/product/{product.slug}</span>
                    </td>
                    <td className="px-4 py-2 text-muted">{product.sku ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(product.price)}</td>
                    <td className={`px-4 py-2 text-right ${stock === 0 ? "text-danger" : ""}`}>
                      {stock}
                    </td>
                    <td className="px-4 py-2">
                      {product.isPublished ? (
                        <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">
                          Опубликован
                        </span>
                      ) : (
                        <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">
                          Черновик
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
                </Fragment>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
