import Link from "next/link";

import { FormMessage } from "@/components/admin/ui";
import { FACET_TYPE_LABELS } from "@/lib/facets";
import { createLandingDraftAction } from "@/server/admin/actions/seo";
import {
  availableCount,
  collectFacets,
  filterByFacet,
  type FacetOption,
} from "@/server/catalog/facets";
import {
  getCategoryBySlug,
  getProductsByCategory,
  getPublishedCategories,
} from "@/server/repositories/catalog";
import {
  getSeoLandings,
  isLandingIndexable,
  MIN_LANDING_PRODUCTS,
} from "@/server/repositories/seo";
import { facetSlugFor } from "@/lib/facets";

type Candidate = {
  sectionSlug: string;
  categorySlug: string;
  categoryTitle: string;
  facet: FacetOption;
};

/**
 * Кандидаты в посадочные: сочетания «категория × фасет», под которые уже
 * есть достаточно товаров в наличии, но страницы ещё нет.
 *
 * Это подсказка, а не автогенерация: черновик создаётся кнопкой,
 * а публикуется только после того, как редактор напишет текст.
 */
function collectCandidates(): Candidate[] {
  const existing = new Set(
    getSeoLandings().map((l) => `${l.sectionSlug}/${l.categorySlug}/${l.facetSlug}`),
  );
  const candidates: Candidate[] = [];

  for (const category of getPublishedCategories()) {
    const products = getProductsByCategory(category.id);
    if (products.length < MIN_LANDING_PRODUCTS) continue;

    const facets = collectFacets(products);
    for (const facet of [...facets.colors, ...facets.sizes, ...facets.materials]) {
      if (facet.count < MIN_LANDING_PRODUCTS) continue;
      const key = `${category.sectionSlug}/${category.slug}/${facetSlugFor(facet.type, facet.value)}`;
      if (existing.has(key)) continue;
      candidates.push({
        sectionSlug: category.sectionSlug,
        categorySlug: category.slug,
        categoryTitle: category.title,
        facet,
      });
    }
  }

  return candidates.sort((a, b) => b.facet.count - a.facet.count);
}

export default async function AdminSeoPage(props: PageProps<"/admin/seo">) {
  const { deleted } = await props.searchParams;
  const landings = getSeoLandings();
  const candidates = collectCandidates();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Посадочные страницы{" "}
          <span className="text-base font-normal text-muted">{landings.length}</span>
        </h1>
        <Link
          href="/admin/seo/landings/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новая посадочная
        </Link>
      </div>

      {deleted && <div className="mt-4"><FormMessage success="Посадочная удалена." /></div>}

      <p className="mt-2 max-w-3xl text-sm text-muted">
        Страницы вида /catalog/zhenskie/classic-mini/chernye. В индекс попадают
        только опубликованные с заполненными метатегами, собственным текстом и
        минимум {MIN_LANDING_PRODUCTS} товарами в наличии. Стартовый объём — до
        сотни страниц; расширять после того, как Вебмастер покажет чистую индексацию.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Адрес</th>
              <th className="px-4 py-2 font-normal">H1</th>
              <th className="px-4 py-2 font-normal text-right">Текст</th>
              <th className="px-4 py-2 font-normal text-right">Товаров</th>
              <th className="px-4 py-2 font-normal">Индексация</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {landings.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Посадочных пока нет.</td></tr>
            )}
            {landings.map((landing) => {
              const category = getCategoryBySlug(landing.sectionSlug, landing.categorySlug);
              const products = category
                ? filterByFacet(getProductsByCategory(category.id), landing.facetType, landing.facetValue)
                : [];
              const count = availableCount(products);
              const indexable = isLandingIndexable(landing, count);

              return (
                <tr key={landing.id} className="hover:bg-sand">
                  <td className="px-4 py-2">
                    <Link href={`/admin/seo/landings/${landing.id}`} className="font-medium hover:text-accent">
                      /{landing.sectionSlug}/{landing.categorySlug}/{landing.facetSlug}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{landing.h1 || landing.title}</td>
                  <td className={`px-4 py-2 text-right ${landing.seoText.trim().length < 400 ? "text-danger" : ""}`}>
                    {landing.seoText.trim().length}
                  </td>
                  <td className={`px-4 py-2 text-right ${count < MIN_LANDING_PRODUCTS ? "text-danger" : ""}`}>
                    {count}
                  </td>
                  <td className="px-4 py-2">
                    {indexable ? (
                      <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">В индексе</span>
                    ) : landing.isPublished ? (
                      <span className="rounded bg-danger/10 px-2 py-0.5 text-xs text-danger">noindex</span>
                    ) : (
                      <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">Черновик</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Кандидаты{" "}
          <span className="text-sm font-normal text-muted">
            — фильтры с {MIN_LANDING_PRODUCTS}+ товарами в наличии, у которых ещё нет страницы
          </span>
        </h2>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Пока нет сочетаний с достаточным количеством товаров.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-normal">Категория</th>
                  <th className="px-4 py-2 font-normal">Фильтр</th>
                  <th className="px-4 py-2 font-normal text-right">Товаров</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidates.slice(0, 100).map((c) => (
                  <tr key={`${c.sectionSlug}/${c.categorySlug}/${c.facet.type}/${c.facet.value}`} className="hover:bg-sand">
                    <td className="px-4 py-2">
                      {c.categoryTitle}
                      <span className="block text-xs text-muted">/{c.sectionSlug}/{c.categorySlug}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted">{FACET_TYPE_LABELS[c.facet.type]}: </span>
                      {c.facet.title}
                    </td>
                    <td className="px-4 py-2 text-right">{c.facet.count}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={createLandingDraftAction}>
                        <input type="hidden" name="sectionSlug" value={c.sectionSlug} />
                        <input type="hidden" name="categorySlug" value={c.categorySlug} />
                        <input type="hidden" name="facetType" value={c.facet.type} />
                        <input type="hidden" name="facetValue" value={c.facet.value} />
                        <button type="submit" className="rounded border border-line px-3 py-1 text-xs hover:border-accent">
                          Создать черновик
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
