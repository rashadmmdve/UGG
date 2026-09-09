import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SECTIONS, SITE_NAME } from "@/lib/constants";
import { plural } from "@/lib/utils";
import {
  getCategoriesBySection,
  getPublishedProducts,
} from "@/server/repositories/catalog";
import { catalogCrumbs } from "@/server/seo/breadcrumbs";

/** Каталог обновляется при изменении товаров, поэтому кэш недолгий. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: `Каталог оригинальной обуви UGG® | ${SITE_NAME}` },
  description:
    "Полный каталог оригинальной обуви UGG®: женские, мужские и детские " +
    "модели, аксессуары. Доставка по России, гарантия подлинности.",
  alternates: { canonical: "/catalog" },
};

export default function CatalogPage() {
  const products = getPublishedProducts();

  return (
    <main className="container-page mx-auto max-w-6xl py-10">
      <Breadcrumbs items={catalogCrumbs()} />

      <h1 className="heading-section mt-6">Каталог</h1>
      <p className="mt-2 text-muted">
        {products.length}{" "}
        {plural(products.length, ["модель", "модели", "моделей"])} в наличии
      </p>

      <div className="mt-10 space-y-12">
        {SECTIONS.map((section) => {
          const categories = getCategoriesBySection(section.slug);

          return (
            <section key={section.slug}>
              <div className="flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="text-xl font-bold">{section.title}</h2>
                <Link
                  href={`/catalog/${section.slug}`}
                  className="text-sm text-accent hover:underline"
                >
                  Все {section.title.toLowerCase()}
                </Link>
              </div>

              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/catalog/${section.slug}/${category.slug}`}
                      className="text-sm hover:text-accent"
                    >
                      {category.shortTitle ?? category.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
