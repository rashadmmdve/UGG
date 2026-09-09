import Link from "next/link";

import { ConfirmForm } from "@/components/admin/ConfirmForm";
import {
  deleteReviewAction,
  setReviewApprovalAction,
} from "@/server/admin/actions/reviews";
import { getProductById } from "@/server/repositories/catalog";
import { getAllReviews } from "@/server/repositories/reviews";

/**
 * Модерация отзывов.
 *
 * Новые отзывы ждут одобрения. Одобряются только настоящие: рейтинг
 * попадает в разметку карточки, и накрутка на выдуманных отзывах
 * ловится и Яндексом, и Google.
 */
export default function AdminReviewsPage() {
  const reviews = getAllReviews();
  const pending = reviews.filter((review) => !review.isApproved);
  const approved = reviews.filter((review) => review.isApproved);

  const Card = ({ review }: { review: (typeof reviews)[number] }) => {
    const product = getProductById(review.productId);
    return (
      <li className="rounded-lg border border-line bg-bg p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-medium">{review.authorName}</span>
            <span className="ml-2 text-accent" aria-label={`Оценка ${review.rating} из 5`}>
              {"★".repeat(review.rating)}
              <span className="text-line-strong">{"★".repeat(5 - review.rating)}</span>
            </span>
          </div>
          <span className="text-xs text-muted">{review.createdAt.slice(0, 10)}</span>
        </div>
        {product ? (
          <Link href={`/admin/products/${product.id}`} className="mt-1 block text-xs text-muted hover:text-accent">
            {product.title}
          </Link>
        ) : (
          <p className="mt-1 text-xs text-danger">Товар удалён</p>
        )}
        <p className="mt-3 text-sm leading-relaxed">{review.text}</p>

        <div className="mt-4 flex gap-2">
          <form action={setReviewApprovalAction}>
            <input type="hidden" name="id" value={review.id} />
            <input type="hidden" name="approved" value={review.isApproved ? "0" : "1"} />
            <button
              type="submit"
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                review.isApproved
                  ? "border border-line hover:border-accent"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {review.isApproved ? "Снять с публикации" : "Одобрить"}
            </button>
          </form>
          <ConfirmForm
            action={deleteReviewAction}
            fields={{ id: review.id }}
            title="Удалить отзыв?"
            description="Отзыв исчезнет без возможности восстановления. Рейтинг товара пересчитается."
            className="rounded px-3 py-1.5 text-xs text-muted hover:text-danger"
          />
        </div>
      </li>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Отзывы{" "}
        <span className="text-base font-normal text-muted">
          {pending.length} на модерации · {approved.length} опубликовано
        </span>
      </h1>

      {reviews.length === 0 && (
        <p className="mt-8 text-sm text-muted">Отзывов пока нет.</p>
      )}

      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="label-caps mb-3">Ждут решения</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {pending.map((review) => <Card key={review.id} review={review} />)}
          </ul>
        </section>
      )}

      {approved.length > 0 && (
        <section className="mt-8">
          <h2 className="label-caps mb-3">Опубликованные</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {approved.map((review) => <Card key={review.id} review={review} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
