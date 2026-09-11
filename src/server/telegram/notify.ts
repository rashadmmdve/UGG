import "server-only";

import { SITE_URL } from "@/lib/constants";
import { isSelfDelivery } from "@/lib/delivery";
import { paymentLabel } from "@/lib/payment-kind";
import { formatPrice, sizeLabel } from "@/lib/utils";
import { chatId, sendMessage, type InlineButton } from "@/server/telegram/client";
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

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Телефон как ссылка: в Телеграме по ней сразу звонят. */
const phoneLink = (phone: string) => `<a href="tel:${escape(phone.replace(/[^\d+]/g, ""))}">${escape(phone)}</a>`;

function composition(order: Order): string {
  return order.items
    .map(
      (item) =>
        `• ${escape(item.title)}${sizeLabel(item.sizeEu) ? `, ${item.sizeEu}` : ""}` +
        `${item.quantity > 1 ? ` × ${item.quantity}` : ""} — ${formatPrice(item.price * item.quantity)}`,
    )
    .join("\n");
}

function where(order: Order): string {
  const kind = order.delivery.mode === "pvz" ? "ПВЗ" : "курьером";
  return `${escape(order.delivery.city)}, ${escape(order.delivery.address)} (${kind})`;
}

const adminLink = (order: Order): InlineButton => ({
  text: "Открыть в админке",
  url: `${SITE_URL}/admin/orders/${order.id}`,
});

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

  if (isSelfDelivery(order.delivery)) notifyDelivery(order);
  if (!paid && order.paymentMethod === "on_delivery") notifyPayments(order);
}

/** Заказ курьерам: адрес, телефон, сумма к получению и две кнопки. */
export function notifyDelivery(order: Order): void {
  const due = order.paymentStatus === "paid" ? "Оплачен — брать деньги не нужно" : `К получению: <b>${formatPrice(order.total)}</b> наличными`;

  safe(
    sendMessage(
      "delivery",
      [
        `🚚 <b>Заказ ${escape(order.number)}</b>`,
        where(order),
        `${escape(order.customer.name)} · ${phoneLink(order.customer.phone)}`,
        due,
        "",
        composition(order),
        order.comment ? `\n💬 ${escape(order.comment)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      [
        [
          { text: "✅ Доставлен", callback_data: `done:${order.id}` },
          { text: "✖️ Отменён", callback_data: `cancel:${order.id}` },
        ],
      ],
    ),
    `заказ курьерам ${order.number}`,
  );
}

/** Заказ в группу оплаты: там администратор выставляет QR. */
export function notifyPayments(order: Order): void {
  safe(
    sendMessage(
      "payments",
      [
        `💳 <b>Заказ ${escape(order.number)}</b> — ${formatPrice(order.total)}`,
        `${paymentLabel(order)}`,
        where(order),
        `${escape(order.customer.name)} · ${phoneLink(order.customer.phone)}`,
      ].join("\n"),
      [[{ text: "Выставить QR на оплату", callback_data: `qr:${order.id}` }, adminLink(order)]],
    ),
    `заказ в оплату ${order.number}`,
  );
}

/** Деньги пришли — знать об этом полезно всем трём группам. */
export function notifyPaid(order: Order): void {
  const text = `✅ <b>Заказ ${escape(order.number)}</b> оплачен — ${formatPrice(order.total)}, ${paymentLabel(order)}`;
  for (const role of ["orders", "payments", "delivery"] as const) {
    if (role === "delivery" && !isSelfDelivery(order.delivery)) continue;
    if (chatId(role)) safe(sendMessage(role, text), `оплата ${order.number}`);
  }
}

/** Отмена — то же самое, но с причиной, если её знают. */
export function notifyCancelled(order: Order, by: string): void {
  const text = `✖️ <b>Заказ ${escape(order.number)}</b> отменён (${escape(by)})`;
  safe(sendMessage("orders", text), `отмена ${order.number}`);
  if (isSelfDelivery(order.delivery)) safe(sendMessage("delivery", text), `отмена ${order.number}`);
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
