import "server-only";

import { SITE_URL } from "@/lib/constants";
import { isSelfDelivery } from "@/lib/delivery";
import { paymentLabel } from "@/lib/payment-kind";
import { formatPrice, sizeLabel } from "@/lib/utils";
import { getOrders } from "@/server/repositories/orders";
import type { InlineButton } from "@/server/telegram/client";
import type { Order } from "@/lib/types";

/**
 * Карточки заказа для Телеграма.
 *
 * Одна и та же карточка приходит сама при оформлении и открывается из
 * меню — поэтому текст и кнопки собираются здесь, а не в двух местах:
 * иначе курьер видел бы разные кнопки в зависимости от того, как нашёл
 * заказ.
 */

export const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Телефон как ссылка: в Телеграме по ней сразу звонят. */
export const phoneLink = (phone: string) =>
  `<a href="tel:${escape(phone.replace(/[^\d+]/g, ""))}">${escape(phone)}</a>`;

export function composition(order: Order): string {
  return order.items
    .map(
      (item) =>
        `• ${escape(item.title)}${sizeLabel(item.sizeEu) ? `, ${item.sizeEu}` : ""}` +
        `${item.quantity > 1 ? ` × ${item.quantity}` : ""} — ${formatPrice(item.price * item.quantity)}`,
    )
    .join("\n");
}

export function where(order: Order): string {
  const kind = order.delivery.mode === "pvz" ? "ПВЗ" : "курьером";
  return `${escape(order.delivery.city)}, ${escape(order.delivery.address)} (${kind})`;
}

export const adminLink = (order: Order): InlineButton => ({
  text: "Открыть в админке",
  url: `${SITE_URL}/admin/orders/${order.id}`,
});

export type Card = { text: string; buttons: InlineButton[][] };

/** Карточка для курьера: куда везти, кому звонить, сколько взять. */
export function deliveryCard(order: Order): Card {
  const paid = order.paymentStatus === "paid";
  const due = paid
    ? "✅ Оплачен — брать деньги не нужно"
    : `К получению: <b>${formatPrice(order.total)}</b>`;

  const text = [
    `🚚 <b>Заказ ${escape(order.number)}</b>`,
    where(order),
    `${escape(order.customer.name)} · ${phoneLink(order.customer.phone)}`,
    due,
    "",
    composition(order),
    order.comment ? `\n💬 ${escape(order.comment)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Кнопки только по делу: у вручённого или отменённого заказа нажимать
  // уже нечего, а просить QR по оплаченному — тем более.
  const settled = order.status === "cancelled" || order.status === "completed";
  const buttons: InlineButton[][] = settled
    ? []
    : [
        [
          { text: "✅ Доставлен", callback_data: `done:${order.id}` },
          { text: "✖️ Отменён", callback_data: `cancel:${order.id}` },
        ],
        ...(paid ? [] : [[{ text: "💳 Запросить QR на оплату", callback_data: `askqr:${order.id}` }]]),
      ];

  return { text, buttons };
}

/** Карточка для группы оплаты: сумма и кнопка выставить QR. */
export function paymentCard(order: Order, asked = false): Card {
  const text = [
    `💳 <b>Заказ ${escape(order.number)}</b> — ${formatPrice(order.total)}`,
    asked ? "🙋 Курьер просит QR: покупатель хочет заплатить картой" : paymentLabel(order),
    where(order),
    `${escape(order.customer.name)} · ${phoneLink(order.customer.phone)}`,
  ].join("\n");

  return {
    text,
    buttons: [[{ text: "Выставить QR на оплату", callback_data: `qr:${order.id}` }, adminLink(order)]],
  };
}

/**
 * Заказы для меню курьера: те, что везём сами и ещё в работе.
 *
 * Вручённые и отменённые не показываем — курьеру нужен список дел, а не
 * архив; за архивом есть админка.
 */
export function activeDeliveryOrders(limit = 20): Order[] {
  return getOrders()
    .filter(
      (order) =>
        isSelfDelivery(order.delivery) &&
        order.status !== "cancelled" &&
        order.status !== "completed",
    )
    .slice(0, limit);
}
