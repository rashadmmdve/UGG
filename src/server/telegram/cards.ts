import "server-only";

import { SITE_URL } from "@/lib/constants";
import { isSelfDelivery } from "@/lib/delivery";
import { paymentLabel } from "@/lib/payment-kind";
import { formatPrice, sizeLabel } from "@/lib/utils";
import { getCourierById, getCourierByTelegramId } from "@/server/repositories/couriers";
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

/**
 * Куда везти.
 *
 * Заказ, который везём сами, к СДЭК отношения не имеет — и упоминать
 * его не нужно. Пункт выдачи в таком заказе тем более: покупатель
 * выбирал его у СДЭК, а поедет к нему наш курьер, и адрес с человеком
 * ещё предстоит согласовать. Остаётся город, а при доставке до двери —
 * настоящий адрес, он и так верный.
 */
export function where(order: Order): string {
  const city = escape(order.delivery.city);
  const address = escape(order.delivery.address);

  if (isSelfDelivery(order.delivery)) {
    return order.delivery.mode === "courier"
      ? `${city}, ${address}`
      : `${city} — адрес согласовать с покупателем`;
  }

  return `${city}, ${address} (${order.delivery.mode === "pvz" ? "ПВЗ СДЭК" : "курьером СДЭК"})`;
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

  const courier = order.courierId ? getCourierById(order.courierId) : null;

  const text = [
    `🚚 <b>Заказ ${escape(order.number)}</b>`,
    courier ? `Курьер: ${escape(courier.name)}` : "Курьер не назначен",
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
 * Заказы для меню: те, что везём сами и ещё в работе.
 *
 * Вручённые и отменённые не показываем — нужен список дел, а не архив;
 * за архивом есть админка.
 *
 * Курьер видит только свои: узнаём его по идентификатору в Телеграме,
 * который подставляет сам Телеграм, — подделать нельзя. Нераспределённые
 * заказы видны всем: их как раз и нужно кому-то забрать. Кто в группе не
 * курьер (оператор, владелец), видит всё.
 */
export function activeDeliveryOrders(telegramId?: string | number, limit = 20): Order[] {
  const courier = telegramId ? getCourierByTelegramId(telegramId) : null;

  return getOrders()
    .filter((order) => {
      if (!isSelfDelivery(order.delivery)) return false;
      if (order.status === "cancelled" || order.status === "completed") return false;
      if (courier) return order.courierId === courier.id || order.courierId === null;
      return true;
    })
    .slice(0, limit);
}
