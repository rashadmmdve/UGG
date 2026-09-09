import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/admin/CategoryForm";
import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { FormMessage } from "@/components/admin/ui";
import { deleteCategoryAction } from "@/server/admin/actions/catalog";
import { getCategoryById, getProductsByCategory } from "@/server/repositories/catalog";

export default async function AdminEditCategoryPage(
  props: PageProps<"/admin/categories/[id]">,
) {
  const { id } = await props.params;
  const { created } = await props.searchParams;

  const category = getCategoryById(id);
  if (!category) notFound();

  const productCount = getProductsByCategory(category.id).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/categories" className="text-sm text-muted hover:text-accent">← Категории</Link>
          <h1 className="mt-2 text-2xl font-bold">{category.title}</h1>
          <Link
            href={`/catalog/${category.sectionSlug}/${category.slug}`}
            target="_blank"
            className="mt-1 inline-block text-sm text-accent hover:underline"
          >
            Открыть на сайте ↗
          </Link>
        </div>
        <ConfirmForm
          action={deleteCategoryAction}
          fields={{ id: category.id }}
          title="Удалить категорию?"
          description={
            productCount > 0
              ? `В категории ${productCount} товаров — они останутся, но потеряют эту привязку. Адрес категории начнёт отдавать 404.`
              : "Адрес категории начнёт отдавать 404. Если он был проиндексирован — лучше не удалять, а скрыть."
          }
        />
      </div>

      {created && <div className="mt-4"><FormMessage success="Категория создана." /></div>}

      <div className="mt-6">
        <CategoryForm category={category} />
      </div>
    </div>
  );
}
