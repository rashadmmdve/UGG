import "server-only";

import { nanoid } from "nanoid";

import { SITE_URL } from "@/lib/constants";
import {
  createYookassaPayment,
  getYookassaPayment,
  isYookassaEnabled,
  toPaymentStatus,
  type YookassaPayment,
} from "@/server/payments/yookassa";
import { isMailEnabled, sendMail } from "@/server/mail/mailer";
import { paidMail } from "@/server/mail/templates";
import { getOrderById, patchOrder } from "@/server/repositories/orders";
import {
  createPayment,
  getPaymentByExternalId,
  getPaymentsByOrderId,
  updatePaymentStatus,
} from "@/server/repositories/payments";
import type { Order, Payment } from "@/lib/types";

/**
 * Жизненный цикл онлайн-платежа.
 *
 * Заказ и платёж — разные сущности: у одного заказа может быть несколько
 * попыток оплаты (покупатель закрыл страницу, банк отказал), и только
 * успешная переводит заказ в «оплачен». Итог приходит двумя путями —
 * вебхуком от ЮKassa и прямым запросом статуса при возврате покупателя
 * на сайт; оба ведут в applyPayment, поэтому порядок их прихода неважен.
 */

/** Куда ЮKassa вернёт покупателя. Идентификатор заказа непредсказуем — в отличие от номера. */
export function paymentReturnUrl(order: Order): string {
  return `${SITE_URL}/checkout/success?order=${order.id}`;
}

export type StartPaymentResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Начать оплату: вернуть адрес страницы ЮKassa.
 *
 * Незавершённая попытка переиспользуется — у ЮKassa платёж живёт около
 * часа, и заводить новый на каждое нажатие «Оплатить» незачем.
 */
export async function startPayment(order: Order): Promise<StartPaymentResult> {
  if (!isYookassaEnabled()) {
    return { ok: false, error: "Онлайн-оплата временно недоступна." };
  }
  if (order.status === "cancelled") {
    return { ok: false, error: "Заказ отменён." };
  }
  if (order.paymentStatus === "paid") {
    return { ok: false, error: "Заказ уже оплачен." };
  }

  const pending = getPaymentsByOrderId(order.id).find(
    (p) => p.status === "pending" && p.confirmationUrl,
  );
  if (pending?.confirmationUrl) {
    // Убеждаемся, что попытка ещё жива, — иначе отправили бы покупателя
    // на просроченную страницу.
    const remote = await getYookassaPayment(pending.externalId).catch(() => null);
    if (remote) {
      const applied = applyPayment(remote);
      if (applied?.status === "paid") return { ok: false, error: "Заказ уже оплачен." };
      if (applied?.status === "pending") return { ok: true, url: pending.confirmationUrl };
    }
  }

  try {
    const idempotenceKey = nanoid(32);
    const remote = await createYookassaPayment({
      order,
      returnUrl: paymentReturnUrl(order),
      idempotenceKey,
    });
    const url = remote.confirmation?.confirmation_url ?? null;

    createPayment({
      externalId: remote.id,
      orderId: order.id,
      amount: order.total,
      status: toPaymentStatus(remote.status),
      idempotenceKey,
      confirmationUrl: url,
    });
    if (order.paymentStatus !== "pending") patchOrder(order.id, { paymentStatus: "pending" });

    if (!url) return { ok: false, error: "ЮKassa не вернула адрес страницы оплаты." };
    return { ok: true, url };
  } catch (error) {
    console.error(`Не удалось создать платёж для заказа ${order.number}:`, error);
    return { ok: false, error: "Не удалось начать оплату. Попробуйте ещё раз через минуту." };
  }
}

/**
 * Применить состояние платежа ЮKassa к нашим записям.
 *
 * Идемпотентно: повторное уведомление с тем же статусом ничего не меняет.
 * Неизвестный платёж игнорируется — мы принимаем только те, что заводили
 * сами, а не всё, что пришло на вебхук.
 */
export function applyPayment(remote: YookassaPayment): Payment | null {
  const existing = getPaymentByExternalId(remote.id);
  if (!existing) return null;

  const status = toPaymentStatus(remote.status);
  const payment =
    existing.status === status ? existing : (updatePaymentStatus(remote.id, status) ?? existing);

  const order = getOrderById(existing.orderId);
  if (!order) return payment;

  if (status === "paid" && order.paymentStatus !== "paid") {
    // Оплаченный заказ считается подтверждённым: менеджеру остаётся
    // только собрать его. Сумму сверяем — платёж на другую сумму
    // заказ не закрывает.
    const paidRub = Number(remote.amount?.value ?? 0);
    if (Math.abs(paidRub - order.total) > 0.005) {
      console.error(
        `Платёж ${remote.id} на ${paidRub} ₽ не совпадает с суммой заказа ${order.number} (${order.total} ₽)`,
      );
      return payment;
    }
    patchOrder(order.id, {
      paymentStatus: "paid",
      status: order.status === "new" ? "confirmed" : order.status,
    });
    // Сюда приходят и вебхук, и сверка со страницы «заказ оформлен»,
    // но переход в «оплачен» случается один раз — письмо тоже одно.
    if (isMailEnabled()) {
      const paid = getOrderById(order.id);
      if (paid) {
        sendMail(paidMail(paid)).catch((error) =>
          console.error(`Не удалось отправить письмо об оплате ${order.number}:`, error),
        );
      }
    }
  } else if (status === "canceled" && order.paymentStatus === "pending") {
    // Попытка не удалась — заказ снова «не оплачен», и его можно оплатить заново.
    const stillPending = getPaymentsByOrderId(order.id).some(
      (p) => p.status === "pending" && p.externalId !== remote.id,
    );
    if (!stillPending) patchOrder(order.id, { paymentStatus: "unpaid" });
  }

  return payment;
}

/**
 * Свериться с ЮKassa по всем незавершённым попыткам заказа.
 * Нужно при возврате покупателя на сайт: вебхук мог ещё не дойти.
 */
export async function syncOrderPayments(order: Order): Promise<Order> {
  if (!isYookassaEnabled()) return order;

  const open = getPaymentsByOrderId(order.id).filter((p) => p.status === "pending");
  for (const payment of open) {
    const remote = await getYookassaPayment(payment.externalId).catch(() => null);
    if (remote) applyPayment(remote);
  }
  return getOrderById(order.id) ?? order;
}

/** Возврат денег через ЮKassa: заказ помечается возвращённым. */
export function applyRefund(paymentId: string): void {
  const payment = getPaymentByExternalId(paymentId);
  if (!payment) return;
  updatePaymentStatus(paymentId, "refunded");
  patchOrder(payment.orderId, { paymentStatus: "refunded" });
}
