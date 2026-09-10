import "server-only";

import { cache } from "react";
import { nanoid } from "nanoid";

import { getDb } from "@/server/db/connection";
import { mapArticle, nowIso, toInt, type ArticleRow } from "@/server/db/mappers";
import type { Article } from "@/lib/types";

/**
 * Статьи блога.
 *
 * Это главный источник геонезависимого трафика: запросы вроде «как
 * чистить угги в домашних условиях» одинаково ранжируются во всех городах,
 * в отличие от коммерческих, где без привязки региона в Яндексе не обойтись.
 */

export const getArticles = cache((): Article[] => {
  const rows = getDb()
    .prepare("SELECT * FROM articles ORDER BY published_at DESC")
    .all() as ArticleRow[];
  return rows.map(mapArticle);
});

export const getPublishedArticles = cache((): Article[] =>
  getArticles().filter((article) => article.isPublished),
);

export const getArticleBySlug = cache((slug: string): Article | null => {
  const row = getDb()
    .prepare("SELECT * FROM articles WHERE slug = ?")
    .get(slug) as ArticleRow | undefined;
  return row ? mapArticle(row) : null;
});

export function saveArticle(
  input: Omit<Article, "id" | "updatedAt"> & { id?: string },
): Article {
  const db = getDb();
  const now = nowIso();

  if (input.id) {
    db.prepare(
      `UPDATE articles
       SET slug = ?, title = ?, excerpt = ?, body = ?, cover = ?, faq = ?,
           is_published = ?, seo = ?, published_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.slug,
      input.title,
      input.excerpt,
      input.body,
      input.cover,
      JSON.stringify(input.faq),
      toInt(input.isPublished),
      JSON.stringify(input.seo),
      input.publishedAt,
      now,
      input.id,
    );
    return { ...input, id: input.id, updatedAt: now };
  }

  const id = nanoid(12);
  db.prepare(
    `INSERT INTO articles
       (id, slug, title, excerpt, body, cover, faq, is_published, seo, published_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.slug,
    input.title,
    input.excerpt,
    input.body,
    input.cover,
    JSON.stringify(input.faq),
    toInt(input.isPublished),
    JSON.stringify(input.seo),
    input.publishedAt,
    now,
  );

  return { ...input, id, updatedAt: now };
}

export function deleteArticle(id: string): void {
  getDb().prepare("DELETE FROM articles WHERE id = ?").run(id);
}
