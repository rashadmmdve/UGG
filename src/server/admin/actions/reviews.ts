"use server";

import { assertAdmin } from "@/server/admin/guard";
import { getProductById } from "@/server/repositories/catalog";
import {
  deleteReview,
  getAllReviews,
  setReviewApproval,
} from "@/server/repositories/reviews";
import { revalidateProduct } from "@/server/seo/revalidate";

/**
 * Модерация отзывов.
 *
 * Одобрение меняет рейтинг товара, а рейтинг попадает в разметку карточки —
 * поэтому после каждого решения сбрасывается кэш страницы товара.
 */
function revalidateFor(reviewId: string): void {
  const review = getAllReviews().find((item) => item.id === reviewId);
  const product = review ? getProductById(review.productId) : null;
  if (product) revalidateProduct(product);
}

export async function setReviewApprovalAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const approved = formData.get("approved") === "1";

  setReviewApproval(id, approved);
  revalidateFor(id);
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  // Товар нужно узнать до удаления — после него отзыв уже не найти.
  const review = getAllReviews().find((item) => item.id === id);
  const product = review ? getProductById(review.productId) : null;

  deleteReview(id);
  if (product) revalidateProduct(product);
}
