"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

import { facetSlugFor } from "@/lib/facets";
import { assertAdmin } from "@/server/admin/guard";
import { facetTitle } from "@/server/catalog/facets";
import { getCategoryBySlug } from "@/server/repositories/catalog";
import {
  deleteRedirect,
  deleteSeoLanding,
  getLanding,
  getRedirects,
  getSeoLandings,
  getSeoSettings,
  saveRedirect,
  saveSeoLanding,
  saveSeoSettings,
} from "@/server/repositories/seo";
import { revalidateContent, revalidateLanding } from "@/server/seo/revalidate";
import {
  DENIED,
  fieldErrorsFrom,
  listField,
  stringOrNull,
  type ActionState,
} from "@/server/validation/errors";
import { redirectSchema, seoLandingSchema } from "@/server/validation/schemas";
import type { LandingFacetType } from "@/lib/types";

/**
 * Действия раздела SEO: посадочные страницы фильтров, редиректы,
 * шаблоны метатегов.
 */

// ─── Посадочные страницы ─────────────────────────────────────────────────────

export async function saveLandingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const existingId = stringOrNull(formData.get("id"));
  const id = existingId ?? nanoid(12);

  const parsed = seoLandingSchema.safeParse({
    id,
    sectionSlug: formData.get("sectionSlug"),
    categorySlug: formData.get("categorySlug"),
    facetSlug: formData.get("facetSlug"),
    facetType: formData.get("facetType"),
    facetValue: formData.get("facetValue"),
    title: formData.get("title"),
    h1: formData.get("h1") ?? "",
    metaTitle: formData.get("metaTitle") ?? "",
    metaDescription: formData.get("metaDescription") ?? "",
    seoText: formData.get("seoText") ?? "",
    aliases: listField(formData, "aliases"),
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const category = getCategoryBySlug(parsed.data.sectionSlug, parsed.data.categorySlug);
  if (!category) {
    return { fieldErrors: { categorySlug: "Такой категории нет в этом разделе" } };
  }

  // Один адрес — одна посадочная. Дубль под тем же фасетом — это как раз
  // та каннибализация, от которой мы уходим.
  const clash = getLanding(
    parsed.data.sectionSlug,
    parsed.data.categorySlug,
    parsed.data.facetSlug,
  );
  if (clash && clash.id !== id) {
    return { fieldErrors: { facetSlug: "Посадочная с таким адресом уже есть" } };
  }

  const previous = existingId ? getSeoLandings().find((l) => l.id === existingId) : null;
  const landing = saveSeoLanding({ ...parsed.data, id: existingId ?? undefined });

  revalidateLanding(landing);
  if (previous) revalidateLanding(previous);

  if (!existingId) redirect(`/admin/seo/landings/${landing.id}?created=1`);
  return { success: "Сохранено" };
}

export async function deleteLandingAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const landing = getSeoLandings().find((item) => item.id === id);
  if (!landing) return;

  deleteSeoLanding(id);
  revalidateLanding(landing);
  redirect("/admin/seo");
}

/**
 * Черновик посадочной из подсказчика кандидатов.
 *
 * Создаётся неопубликованным, с заголовками по шаблону и пустым текстом.
 * Публиковать сразу нельзя: без собственного текста страница — дорвей.
 */
export async function createLandingDraftAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const sectionSlug = String(formData.get("sectionSlug") ?? "");
  const categorySlug = String(formData.get("categorySlug") ?? "");
  const facetType = String(formData.get("facetType") ?? "") as LandingFacetType;
  const facetValue = String(formData.get("facetValue") ?? "");

  if (!["color", "size", "material"].includes(facetType)) return;

  const category = getCategoryBySlug(sectionSlug, categorySlug);
  if (!category) return;

  const facetSlug = facetSlugFor(facetType, facetValue);
  const existing = getLanding(sectionSlug, categorySlug, facetSlug);
  if (existing) redirect(`/admin/seo/landings/${existing.id}`);

  const facet = facetTitle(facetType, facetValue);
  const facetCap = facet.charAt(0).toUpperCase() + facet.slice(1);
  const h1 =
    facetType === "size"
      ? `${category.title} ${facet}`
      : `${facetCap} ${category.title}`;

  const landing = saveSeoLanding({
    sectionSlug,
    categorySlug,
    facetSlug,
    facetType,
    facetValue,
    title: facetCap,
    h1,
    metaTitle: `${h1} — купить оригинал`,
    metaDescription: "",
    seoText: "",
    aliases: [],
    isPublished: false,
  });

  redirect(`/admin/seo/landings/${landing.id}?created=1`);
}

// ─── Редиректы ───────────────────────────────────────────────────────────────

export async function saveRedirectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const existingId = stringOrNull(formData.get("id"));

  const parsed = redirectSchema.safeParse({
    id: existingId ?? nanoid(12),
    from: formData.get("from"),
    to: formData.get("to") ?? "",
    code: Number(formData.get("code") ?? 301),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (parsed.data.code === 301 && !parsed.data.to) {
    return { fieldErrors: { to: "Для 301 нужен адрес назначения" } };
  }

  if (parsed.data.from === parsed.data.to) {
    return { fieldErrors: { to: "Адрес назначения совпадает с исходным" } };
  }

  const clash = getRedirects().find(
    (item) => item.from === parsed.data.from && item.id !== parsed.data.id,
  );
  if (clash) {
    return { fieldErrors: { from: "Для этого адреса редирект уже задан" } };
  }

  saveRedirect({ ...parsed.data, id: existingId ?? undefined });
  revalidateContent();

  return { success: "Сохранено" };
}

export async function deleteRedirectAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;
  deleteRedirect(String(formData.get("id") ?? ""));
  revalidateContent();
}

// ─── Шаблоны и настройки ─────────────────────────────────────────────────────

export async function saveSeoSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const templates = {
    category: { title: text("categoryTitle"), description: text("categoryDescription") },
    product: { title: text("productTitle"), description: text("productDescription") },
    landing: { title: text("landingTitle"), description: text("landingDescription") },
  };

  for (const [name, template] of Object.entries(templates)) {
    if (!template.title || !template.description) {
      return { fieldErrors: { [`${name}Title`]: "Шаблон не может быть пустым" } };
    }
  }

  const current = getSeoSettings();
  saveSeoSettings({
    ...current,
    yandexMetrikaId: text("yandexMetrikaId"),
    googleAnalyticsId: text("googleAnalyticsId"),
    yandexVerification: text("yandexVerification"),
    googleVerification: text("googleVerification"),
    templates,
  });

  revalidateContent();
  return { success: "Сохранено. Метатеги пересоберутся при следующем обновлении страниц." };
}
