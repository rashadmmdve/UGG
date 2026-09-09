"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

import { assertAdmin } from "@/server/admin/guard";
import {
  deleteArticle,
  getArticleBySlug,
  getArticles,
  saveArticle,
} from "@/server/repositories/articles";
import { revalidateArticle } from "@/server/seo/revalidate";
import {
  DENIED,
  fieldErrorsFrom,
  jsonField,
  stringOrNull,
  type ActionState,
} from "@/server/validation/errors";
import { articleSchema } from "@/server/validation/schemas";

export async function saveArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const existingId = stringOrNull(formData.get("id"));
  const existing = existingId
    ? getArticles().find((article) => article.id === existingId)
    : null;

  // Дата из поля date — только день. Если день не менялся, оставляем
  // прежнюю отметку времени, чтобы порядок статей не прыгал.
  const day = stringOrNull(formData.get("publishedAt"));
  const publishedAt =
    existing && day === existing.publishedAt.slice(0, 10)
      ? existing.publishedAt
      : `${day ?? new Date().toISOString().slice(0, 10)}T09:00:00.000Z`;

  const parsed = articleSchema.safeParse({
    id: existingId ?? nanoid(12),
    slug: formData.get("slug"),
    title: formData.get("title"),
    excerpt: formData.get("excerpt") ?? "",
    body: formData.get("body") ?? "",
    cover: stringOrNull(formData.get("cover")),
    faq: jsonField(formData, "faq", []),
    isPublished: formData.get("isPublished") === "on",
    publishedAt,
    seo: {
      metaTitle: String(formData.get("seoMetaTitle") ?? ""),
      metaDescription: String(formData.get("seoMetaDescription") ?? ""),
      h1: "",
      seoText: "",
      noindex: formData.get("seoNoindex") === "on",
    },
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const clash = getArticleBySlug(parsed.data.slug);
  if (clash && clash.id !== parsed.data.id) {
    return { fieldErrors: { slug: "Такой адрес уже занят другой статьёй" } };
  }

  const article = saveArticle({
    ...parsed.data,
    id: existingId ?? undefined,
    seo: {
      metaTitle: parsed.data.seo.metaTitle || undefined,
      metaDescription: parsed.data.seo.metaDescription || undefined,
      noindex: parsed.data.seo.noindex,
    },
  });

  revalidateArticle(article.slug, existing?.slug);

  if (!existingId) redirect(`/admin/articles/${article.id}?created=1`);
  return { success: "Сохранено" };
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const article = getArticles().find((item) => item.id === id);
  if (!article) return;

  deleteArticle(id);
  revalidateArticle(article.slug);
  redirect("/admin/articles");
}
