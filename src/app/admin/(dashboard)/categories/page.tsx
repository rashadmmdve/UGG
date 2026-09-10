import Link from "next/link";

import { genderSections } from "@/server/catalog/sections";
import {
  getCategories,
  getProductsByCategory,
} from "@/server/repositories/catalog";

export default function AdminCategoriesPage() {
  const categories = getCategories();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Категории <span className="text-base font-normal text-muted">{categories.length}</span>
        </h1>
        <Link
          href="/admin/categories/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новая категория
        </Link>
      </div>

      <p className="mt-2 text-sm text-muted">
        Категория без товаров открывается, но закрыта от индексации и не попадает в карту сайта.
      </p>

      <div className="mt-6 space-y-8">
        {genderSections().map((section) => {
          const items = categories.filter((c) => c.sectionSlug === section.slug);
          if (items.length === 0) return null;

          return (
            <section key={section.slug}>
              <h2 className="label-caps mb-2">{section.title} — {items.length}</h2>
              <div className="overflow-x-auto rounded-lg border border-line bg-bg">
                <table className="w-full text-sm">
                  <thead className="bg-elevated text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-normal">Название</th>
                      <th className="px-4 py-2 font-normal">Адрес</th>
                      <th className="px-4 py-2 font-normal text-right">Товаров</th>
                      <th className="px-4 py-2 font-normal text-right">Синонимов</th>
                      <th className="px-4 py-2 font-normal">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((category) => {
                      const count = getProductsByCategory(category.id).length;
                      return (
                        <tr key={category.id} className="hover:bg-sand">
                          <td className="px-4 py-2">
                            <Link href={`/admin/categories/${category.id}`} className="font-medium hover:text-accent">
                              {category.title}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-muted">/{section.slug}/{category.slug}</td>
                          <td className={`px-4 py-2 text-right ${count === 0 ? "text-muted" : ""}`}>{count}</td>
                          <td className="px-4 py-2 text-right text-muted">{category.aliases.length}</td>
                          <td className="px-4 py-2">
                            {category.isPublished ? (
                              <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">Опубликована</span>
                            ) : (
                              <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">Скрыта</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
