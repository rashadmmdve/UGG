import "server-only";

import { PAYMENT_METHOD_LABELS, SITE_URL } from "@/lib/constants";
import { formatPrice, sizeLabel } from "@/lib/utils";
import type { Mail } from "@/server/mail/mailer";
import type { Order } from "@/lib/types";

/**
 * Письма сайта. Вёрстка — таблицы и встроенные стили: почтовые программы
 * не понимают ни классов, ни современных CSS-свойств, и всё, что не
 * написано прямо в атрибуте style, они отбрасывают.
 */

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Ubuntu,Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:8px">
<tr><td style="padding:28px 32px 8px;font-size:22px;font-weight:700;letter-spacing:1px">UGG</td></tr>
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.5;color:#777">
Письмо отправлено автоматически с сайта <a href="${SITE_URL}" style="color:#777">${SITE_URL.replace(/^https?:\/\//, "")}</a>. Ответить на него нельзя — пишите на info@uggrussia.shop.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:600">${escape(label)}</a></p>`;

/** Подтверждение почты после регистрации. */
export function verificationMail(input: { to: string; name: string; url: string }): Mail {
  const greeting = input.name ? `Здравствуйте, ${escape(input.name)}!` : "Здравствуйте!";
  return {
    to: input.to,
    subject: "Подтвердите почту — UGG",
    html: layout(
      "Подтвердите почту",
      `<p style="margin:0 0 12px">${greeting}</p>
<p style="margin:0">Вы зарегистрировались в магазине UGG. Осталось подтвердить, что почта ваша, — нажмите кнопку:</p>
${button(input.url, "Подтвердить почту")}
<p style="margin:0 0 12px;color:#555">Ссылка действует сутки. Если кнопка не открывается, скопируйте адрес в браузер:<br><a href="${input.url}" style="color:#555;word-break:break-all">${input.url}</a></p>
<p style="margin:0;color:#555">Если вы не регистрировались — просто не отвечайте на письмо, аккаунт не активируется.</p>`,
    ),
    text: `${input.name ? `Здравствуйте, ${input.name}!` : "Здравствуйте!"}

Вы зарегистрировались в магазине UGG. Чтобы подтвердить почту, откройте ссылку (действует сутки):
${input.url}

Если вы не регистрировались — не отвечайте на письмо, аккаунт не активируется.`,
  };
}

/** Ссылка на смену пароля. */
export function passwordResetMail(input: { to: string; name: string; url: string }): Mail {
  const greeting = input.name ? `Здравствуйте, ${escape(input.name)}!` : "Здравствуйте!";
  return {
    to: input.to,
    subject: "Восстановление пароля — UGG",
    html: layout(
      "Восстановление пароля",
      `<p style="margin:0 0 12px">${greeting}</p>
<p style="margin:0">Кто-то запросил новый пароль для вашего аккаунта в магазине UGG. Если это вы — нажмите кнопку и задайте новый:</p>
${button(input.url, "Задать новый пароль")}
<p style="margin:0 0 12px;color:#555">Ссылка действует один час. Если кнопка не открывается, скопируйте адрес в браузер:<br><a href="${input.url}" style="color:#555;word-break:break-all">${input.url}</a></p>
<p style="margin:0;color:#555">Если вы ничего не запрашивали — просто не отвечайте на письмо, пароль останется прежним.</p>`,
    ),
    text: `${input.name ? `Здравствуйте, ${input.name}!` : "Здравствуйте!"}

Кто-то запросил новый пароль для вашего аккаунта в магазине UGG. Если это вы, откройте ссылку (действует час):
${input.url}

Если вы ничего не запрашивали — не отвечайте на письмо, пароль останется прежним.`,
  };
}

/** Подтверждение заказа покупателю. */
export function orderMail(order: Order, payUrl: string | null): Mail {
  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escape(item.title)}<span style="color:#777">${sizeLabel(item.sizeEu) ? ` · ${item.sizeEu}` : ""}${item.quantity > 1 ? ` × ${item.quantity}` : ""}</span></td><td align="right" style="padding:6px 0;border-bottom:1px solid #eee;white-space:nowrap">${formatPrice(item.price * item.quantity)}</td></tr>`,
    )
    .join("");
  const totals = [
    ["Товары", formatPrice(order.subtotal)],
    ...(order.discount > 0 ? [["Скидка", `−${formatPrice(order.discount)}`]] : []),
    ["Доставка", formatPrice(order.deliveryPrice)],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 0;color:#777">${k}</td><td align="right" style="padding:4px 0">${v}</td></tr>`)
    .join("");

  const delivery =
    order.delivery.mode === "pvz"
      ? `Пункт выдачи СДЭК: ${escape(order.delivery.city)}, ${escape(order.delivery.address)}`
      : `Курьером СДЭК: ${escape(order.delivery.city)}, ${escape(order.delivery.address)}`;

  const payment =
    order.paymentMethod === "online"
      ? order.paymentStatus === "paid"
        ? "Оплачен картой на сайте."
        : "Ожидает оплаты картой."
      : "Оплата при получении — наличными или картой.";

  const html = layout(
    `Заказ ${order.number}`,
    `<p style="margin:0 0 12px">${order.customer.name ? `${escape(order.customer.name)}, спасибо` : "Спасибо"} за заказ <strong>${order.number}</strong>!</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:16px 0">${rows}${totals}
<tr><td style="padding:10px 0 0;font-weight:700">Итого</td><td align="right" style="padding:10px 0 0;font-weight:700;font-size:16px">${formatPrice(order.total)}</td></tr></table>
<p style="margin:0 0 8px"><strong>Доставка.</strong> ${delivery}</p>
<p style="margin:0 0 8px"><strong>Оплата.</strong> ${PAYMENT_METHOD_LABELS[order.paymentMethod]}. ${payment}</p>
${payUrl ? button(payUrl, "Оплатить заказ") : ""}
<p style="margin:16px 0 0;color:#555">Когда посылка уйдёт в СДЭК, трек-номер появится в личном кабинете: <a href="${SITE_URL}/account" style="color:#555">${SITE_URL.replace(/^https?:\/\//, "")}/account</a></p>`,
  );

  const text = [
    `Спасибо за заказ ${order.number}!`,
    "",
    ...order.items.map(
      (i) =>
        `${i.title}${sizeLabel(i.sizeEu) ? ` · ${i.sizeEu}` : ""}${i.quantity > 1 ? ` × ${i.quantity}` : ""} — ${formatPrice(i.price * i.quantity)}`,
    ),
    "",
    `Товары: ${formatPrice(order.subtotal)}`,
    ...(order.discount > 0 ? [`Скидка: −${formatPrice(order.discount)}`] : []),
    `Доставка: ${formatPrice(order.deliveryPrice)}`,
    `Итого: ${formatPrice(order.total)}`,
    "",
    delivery.replace(/<[^>]+>/g, ""),
    `Оплата: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}. ${payment}`,
    ...(payUrl ? ["", `Оплатить: ${payUrl}`] : []),
    "",
    `Личный кабинет: ${SITE_URL}/account`,
  ].join("\n");

  return { to: order.customer.email, subject: `Заказ ${order.number} принят — UGG`, html, text };
}
