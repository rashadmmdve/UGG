import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { ProductForm } from "@/components/admin/ProductForm";
import { FormMessage } from "@/components/admin/ui";
import {
  cloneProductAction,
  deleteProductAction,
} from "@/server/admin/actions/catalog";
import {
  getCategories,
  getColors,
  getModelLines,
  getProductById,
  getSizeCharts,
} from "@/server/repositories/catalog";

export default async function AdminEditProductPage(
  props: PageProps<"/admin/products/[id]">,
) {
  const { id } = await props.params;
  const { created, cloned } = await props.searchParams;

  const product = getProductById(id);
  if (!product) notFound();

  const banner = created
    ? "Товар создан. Теперь его можно клонировать под другие цвета."
    : cloned
      ? "Копия создана: укажите цвет, загрузите фото, проставьте остатки и опубликуйте."
      : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm text-muted hover:text-accent">
            ← Товары
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{product.title}</h1>
          {product.isPublished && (
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              className="mt-1 inline-block text-sm text-accent hover:underline"
            >
              Открыть на сайте ↗
            </Link>
          )}
        </div>

        <div className="flex gap-2">
          <form action={cloneProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded border border-line px-4 text-sm hover:border-accent"
              title="Создать копию под другой цвет"
            >
              Клонировать под другой цвет
            </button>
          </form>
          <ConfirmForm
            action={deleteProductAction}
            fields={{ id: product.id }}
            title="Удалить товар?"
            description={`«${product.title}» будет удалён вместе со всеми размерами. Заказы, в которых он есть, сохранят свои данные.`}
          />
        </div>
      </div>

      {banner && (
        <div className="mt-4">
          <FormMessage success={banner} />
        </div>
      )}

      <div className="mt-6">
        <ProductForm
          product={product}
          categories={getCategories()}
          modelLines={getModelLines()}
          colors={getColors()}
          sizeCharts={getSizeCharts()}
        />
      </div>
    </div>
  );
}
