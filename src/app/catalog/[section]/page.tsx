import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SECTIONS } from "@/lib/constants";
import { plural } from "@/lib/utils";
import {
  getCategoriesBySection,
  getProductsBySection,
} from "@/server/repositories/catalog";
import { sectionCrumbs } from "@/server/seo/breadcrumbs";
import { buildMetadata, minPrice } from "@/server/seo/meta";

export const revalidate = 600;

/**
 * Разделов ровно четыре, и они заданы константой, а не справочником:
 * это часть структуры адресов, а не редактируемые данные.
 */
export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section: section.slug }));
}

function findSection(slug: string) {
  return SECTIONS.find((section) => section.slug === slug) ?? null;
}

export async function generateMetadata(
  props: PageProps<"/catalog/[section]">,
): Promise<Metadata> {
  const { section: sectionSlug } = await props.params;
  const section = findSection(sectionSlug);
  if (!section) return {};

  const products = getProductsBySection(sectionSlug);

  return buildMetadata({
    path: `/catalog/${sectionSlug}`,
    template: "category",
    tokens: {
      category: `${section.title} UGG`,
      count: products.length,
      minPrice: minPrice(products),
    },
  });
}

export default async function SectionPage(
  props: PageProps<"/catalog/[section]">,
) {
  const { section: sectionSlug } = await props.params;
  const section = findSection(sectionSlug);

  // Неизвестный раздел — честный 404, а не пустая страница со статусом 200.
  if (!section) notFound();

  const categories = getCategoriesBySection(sectionSlug);
  const products = getProductsBySection(sectionSlug);

  return (
    <main className="container-page mx-auto max-w-6xl py-10">
      <Breadcrumbs items={sectionCrumbs(sectionSlug)} />

      <h1 className="heading-section mt-6">{section.title} UGG</h1>
      <p className="mt-2 text-muted">
        {products.length}{" "}
        {plural(products.length, ["модель", "модели", "моделей"])} в наличии
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/catalog/${sectionSlug}/${category.slug}`}
              className="block rounded-lg border border-line bg-sand p-4 transition hover:border-accent"
            >
              <span className="text-sm font-medium">
                {category.shortTitle ?? category.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {categories.length === 0 && (
        <p className="mt-8 text-muted">В этом разделе пока нет категорий.</p>
      )}
    </main>
  );
}
