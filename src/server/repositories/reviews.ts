import "server-only";

import { cache } from "react";
import { nanoid } from "nanoid";

import { getDb, transaction } from "@/server/db/connection";
import { mapReview, nowIso, toInt, type ReviewRow } from "@/server/db/mappers";
import type { Review } from "@/lib/types";

/**
 * Отзывы.
 *
 * Публикуются только после модерации и только настоящие. Разметка
 * AggregateRating на выдуманных отзывах — прямой путь к ручным санкциям
 * и в Яндексе, и в Google, поэтому рейтинг считается исключительно по
 * одобренным записям, а при их отсутствии не выводится вовсе.
 */

export const getApprovedReviews = cache((productId: string): Review[] => {
  const rows = getDb()
    .prepare(
      `SELECT * FROM reviews
       WHERE product_id = ? AND is_approved = 1
       ORDER BY created_at DESC`,
    )
    .all(productId) as ReviewRow[];
  return rows.map(mapReview);
});

/** Все отзывы, включая ждущие модерации, — для админки. */
export function getAllReviews(): Review[] {
  const rows = getDb()
    .prepare("SELECT * FROM reviews ORDER BY created_at DESC")
    .all() as ReviewRow[];
  return rows.map(mapReview);
}

export function getPendingReviews(): Review[] {
  const rows = getDb()
    .prepare("SELECT * FROM reviews WHERE is_approved = 0 ORDER BY created_at DESC")
    .all() as ReviewRow[];
  return rows.map(mapReview);
}

export function createReview(input: {
  productId: string;
  userId: string | null;
  authorName: string;
  rating: Review["rating"];
  text: string;
  photos: string[];
}): Review {
  const review: Review = {
    ...input,
    id: nanoid(12),
    // Новый отзыв всегда попадает на модерацию.
    isApproved: false,
    createdAt: nowIso(),
  };

  getDb()
    .prepare(
      `INSERT INTO reviews
         (id, product_id, user_id, author_name, rating, text, photos, is_approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      review.id,
      review.productId,
      review.userId,
      review.authorName,
      review.rating,
      review.text,
      JSON.stringify(review.photos),
      review.createdAt,
    );

  return review;
}

/**
 * Одобрить или снять с публикации, затем пересчитать рейтинг товара.
 *
 * Рейтинг денормализован в карточке товара, чтобы не пересчитывать его
 * при каждом рендере каталога. Обе операции идут одной транзакцией:
 * расхождение между отзывами и выведенным рейтингом попало бы в разметку.
 */
export function setReviewApproval(id: string, isApproved: boolean): void {
  transaction(() => {
    const db = getDb();
    const row = db
      .prepare("SELECT product_id FROM reviews WHERE id = ?")
      .get(id) as { product_id: string } | undefined;
    if (!row) return;

    db.prepare("UPDATE reviews SET is_approved = ? WHERE id = ?").run(
      toInt(isApproved),
      id,
    );

    recalculateRating(row.product_id);
  });
}

export function deleteReview(id: string): void {
  transaction(() => {
    const db = getDb();
    const row = db
      .prepare("SELECT product_id FROM reviews WHERE id = ?")
      .get(id) as { product_id: string } | undefined;
    db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
    if (row) recalculateRating(row.product_id);
  });
}

/** Пересчёт агрегированного рейтинга товара по одобренным отзывам. */
function recalculateRating(productId: string): void {
  const db = getDb();
  const stats = db
    .prepare(
      `SELECT AVG(rating) AS avg, COUNT(*) AS count
       FROM reviews WHERE product_id = ? AND is_approved = 1`,
    )
    .get(productId) as { avg: number | null; count: number };

  db.prepare(
    "UPDATE products SET rating_value = ?, rating_count = ? WHERE id = ?",
  ).run(
    stats.count > 0 && stats.avg !== null
      ? Math.round(stats.avg * 10) / 10
      : null,
    stats.count,
    productId,
  );
}
