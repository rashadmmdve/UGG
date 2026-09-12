import "server-only";

import { isSelfDelivery } from "@/lib/delivery";
import { paymentLabel } from "@/lib/payment-kind";
import { formatPrice } from "@/lib/utils";
import { getPaymentsByOrderId } from "@/server/repositories/payments";
import { chatId, sendMessage, type InlineButton } from "@/server/telegram/client";
import {
  adminLink,
  composition,
  escape,
  paymentCard,
  phoneLink,
  where,
} from "@/server/telegram/cards";
import type { Order } from "@/lib/types";

/**
 * Что бот пишет в группы.
 *
 * Каждый заказ — отдельное сообщение с кнопками: нажал и сделал, без
 * перехода в админку. Курьерам уходят только те заказы, которые везём
 * сами, и с телефоном покупателя — без него курьеру не позвонить.
 *
 * Сбой Телеграма никогда не роняет то, ради чего его позвали: заказ
 * важнее уведомления о нём, поэтому все вызовы гасят свои ошибки в лог.
 */

function safe(promise: Promise<unknown>, what: string): void {
  promise.catch((error) => console.error(`Телеграм: ${what}:`, error));
}

/** Новый заказ: администраторам — всегда, курьерам — если везём сами. */
export function notifyNewOrder(order: Order): void {
  const paid = order.paymentStatus === "paid";

  safe(
    sendMessage(
      "orders",
      [
        `🧾 <b>Заказ ${escape(order.number)}</b> — ${formatPrice(order.total)}`,
        `${paymentLabel(order)} · ${paid ? "оплачен" : "не оплачен"}`,
        isSelfDelivery(order.delivery) ? "Везём сами" : "Доставка СДЭК",
        where(order),
        `${escape(order.customer.name)} · ${phoneLink(order.customer.phone)}`,
        "",
        composition(order),
        order.comment ? `\n💬 ${escape(order.comment)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      [
        [
          ...(isSelfDelivery(order.delivery)
            ? []
            : ([{ text: "Везём сами", callback_data: `self:${order.id}` }] as InlineButton[])),
          adminLink(order),
        ],
      ],
    ),
    `новый заказ ${order.number}`,
  );

  // Курьерам заказ сам не уходит: они получают список, когда оператор
  // всё раздал и нажал «Отправить» (или утром, если включена рассылка).
  // В группу оплаты — тоже нет: там работают по просьбе курьера.
}

/**
 * Заказ в группу оплаты: там администратор выставляет QR.
 *
 * @param asked Просьба пришла от курьера — покупатель на месте решил
 * платить картой. Такое сообщение отличается от обычного: по нему видно,
 * что человек ждёт прямо сейчас.
 */
export function notifyPayments(order: Order, asked = false): void {
  const card = paymentCard(order, asked);
  safe(sendMessage("payments", card.text, card.buttons), `заказ в оплату ${order.number}`);
}

/** Деньги пришли — знать об этом полезно всем трём группам. */
export function notifyPaid(order: Order): void {
  const text = `✅ <b>Заказ ${escape(order.number)}</b> оплачен — ${formatPrice(order.total)}, ${paymentLabel(order)}`;
  for (const role of ["orders", "payments", "delivery"] as const) {
    if (role === "delivery" && !isSelfDelivery(order.delivery)) continue;
    if (chatId(role)) safe(sendMessage(role, text), `оплата ${order.number}`);
  }
}

/**
 * Отмена заказа.
 *
 * В оплату уходит всегда, даже если счёт по заказу не выставляли: там
 * сидят те, кто может получить деньги по старой ссылке. Если счёт всё же
 * выставлен, предупреждаем отдельно — ссылку ЮKassa досрочно не погасить,
 * она живёт около часа, и покупатель ещё может по ней заплатить.
 */
export function notifyCancelled(order: Order, by: string): void {
  const text = `✖️ <b>Заказ ${escape(order.number)}</b> отменён (${escape(by)})`;
  const issued = getPaymentsByOrderId(order.id).some((payment) => payment.confirmationUrl);

  safe(sendMessage("orders", text), `отмена ${order.number}`);
  if (isSelfDelivery(order.delivery)) safe(sendMessage("delivery", text), `отмена ${order.number}`);

  const forPayments = issued
    ? `${text}
⚠️ По заказу выставляли счёт: ссылка может ещё работать около часа. Если деньги придут — их нужно вернуть.`
    : text;
  safe(sendMessage("payments", forPayments), `отмена ${order.number}`);
}

/**
 * Деньги пришли по отменённому заказу.
 *
 * Так бывает, когда счёт выставили, заказ отменили, а покупатель успел
 * оплатить по старому QR: ссылка ЮKassa живёт около часа, и погасить её
 * досрочно нельзя. Заказ при этом не воскресает — деньги нужно вернуть
 * руками, поэтому кричим об этом в обе группы, где сидят люди с доступом
 * к кассе.
 */
export function notifyStrayPayment(order: Order, amount: number): void {
  const text = [
    `⚠️ <b>Оплата по отменённому заказу ${escape(order.number)}</b>`,
    `Пришло ${formatPrice(amount)}. Заказ отменён, товары вернулись в каталог.`,
    "Деньги нужно вернуть покупателю в личном кабинете ЮKassa.",
  ].join("\n");

  for (const role of ["orders", "payments"] as const) {
    if (chatId(role)) safe(sendMessage(role, text), `оплата отменённого ${order.number}`);
  }
}

/** Заказ вернули в работу из отменённых. */
export function notifyRestored(order: Order, by: string): void {
  const text = `↩️ <b>Заказ ${escape(order.number)}</b> восстановлен (${escape(by)})`;
  safe(sendMessage("orders", text), `восстановление ${order.number}`);
}
