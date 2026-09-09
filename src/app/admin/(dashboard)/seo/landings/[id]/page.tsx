import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { LandingForm } from "@/components/admin/LandingForm";
import { FormMessage } from "@/components/admin/ui";
import { deleteLandingAction } from "@/server/admin/actions/seo";
import { availableCount, filterByFacet } from "@/server/catalog/facets";
import {
  getCategoryBySlug,
  getColors,
  getProductsByCategory,
  getPublishedCategories,
} from "@/server/repositories/catalog";
import { getSeoLandings, isLandingIndexable } from "@/server/repositories/seo";

export default async function AdminEditLandingPage(
  props: PageProps<"/admin/seo/landings/[id]">,
) {
  const { id } = await props.params;
  const { created } = await props.searchParams;

  const landing = getSeoLandings().find((item) => item.id === id);
  if (!landing) notFound();

  const category = getCategoryBySlug(landing.sectionSlug, landing.categorySlug);
  const products = category
    ? filterByFacet(getProductsByCategory(category.id), landing.facetType, landing.facetValue)
    : [];
  const count = availableCount(products);
  const indexable = isLandingIndexable(landing, count);
  const path = `/catalog/${landing.sectionSlug}/${landing.categorySlug}/${landing.facetSlug}`;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/seo" className="text-sm text-muted hover:text-accent">← Посадочные страницы</Link>
          <h1 className="mt-2 text-2xl font-bold">{landing.h1 || landing.title}</h1>
          <p className="mt-1 text-sm">
            <Link href={path} target="_blank" className="text-accent hover:underline">{path} ↗</Link>
            <span className="ml-3 text-muted">
              {indexable ? "в индексе" : landing.isPublished ? "опубликована, но закрыта от индексации" : "черновик"}
            </span>
          </p>
        </div>
        <ConfirmForm
          action={deleteLandingAction}
          fields={{ id: landing.id }}
          title="Удалить посадочную?"
          description="Адрес начнёт отдавать 404. Если страница уже в индексе — добавьте редирект на категорию."
        />
      </div>

      {created && (
        <div className="mt-4">
          <FormMessage success="Черновик создан. Напишите текст, проверьте заголовки и опубликуйте." />
        </div>
      )}

      <div className="mt-6">
        <LandingForm
          landing={landing}
          categories={getPublishedCategories()}
          colors={getColors()}
          productCount={count}
        />
      </div>
    </div>
  );
}
