import Link from "next/link";

import {
  AdminProductTable,
  type AdminProductGroup,
  type AdminProductRow,
} from "@/components/admin/AdminProductTable";
import { BulkPublishBar } from "@/components/admin/BulkPublish";
import { getCategoryById, getProducts } from "@/server/repositories/catalog";
import type { Product } from "@/lib/types";

const GENDER_TITLE: Record<string, string> = { women: "Женские", men: "Мужские", kids: "Детские" };
const GENDER_ORDER = ["women", "men", "kids"];

/**
 * Группы «пол → категория» в порядке разделов; внутри категории — как
 * пришли из базы (новые первыми). Без категории — в конец раздела.
 */
function groupProducts(products: Product[]): AdminProductGroup[] {
  const byGender = new Map<string, Map<string, AdminProductRow[]>>();

  for (const product of products) {
    const category = product.primaryCategoryId
      ? (getCategoryById(product.primaryCategoryId)?.title ?? "Без категории")
      : "Без категории";
    const categories = byGender.get(product.gender) ?? new Map<string, AdminProductRow[]>();
    categories.set(category, [
      ...(categories.get(category) ?? []),
      {
        id: product.id,
        title: product.title,
        slug: product.slug,
        sku: product.sku ?? null,
        price: product.price,
        stock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
        published: product.isPublished,
      },
    ]);
    byGender.set(product.gender, categories);
  }

  const rank = (gender: string) => {
    const index = GENDER_ORDER.indexOf(gender);
    return index === -1 ? GENDER_ORDER.length : index;
  };

  return [...byGender.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((gender) => ({
      key: `gender-${gender}`,
      title: GENDER_TITLE[gender] ?? gender,
      categories: [...byGender.get(gender)!.entries()]
        .sort((a, b) =>
          a[0] === "Без категории" ? 1 : b[0] === "Без категории" ? -1 : a[0].localeCompare(b[0], "ru"),
        )
        .map(([title, items]) => ({ key: `cat-${gender}-${title}`, title, items })),
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
        <AdminProductTable groups={groupProducts(products)} />
      )}
    </div>
  );
}
