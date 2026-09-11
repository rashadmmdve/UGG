import "server-only";

/**
 * Телеграм: низкоуровневые вызовы Bot API.
 *
 * Групп три — по одной на роль: заказы для администраторов, доставка для
 * курьеров, оплата для тех, кто выставляет QR. У каждой свой бот и свой
 * токен, поэтому бот курьеров физически не может написать в группу
 * администраторов: разделение не на проверках в коде, а на уровне
 * доступа.
 *
 * Роль, за которую отвечает вызов, передаётся первым аргументом — она же
 * выбирает и токен, и группу. Без настроек бот молчит: нет токена или
 * группы — ни одного запроса. Магазин от этого не ломается.
 */

export type ChatRole = "orders" | "delivery" | "payments";

export const CHAT_ROLES: ChatRole[] = ["orders", "delivery", "payments"];

const TOKEN_ENV: Record<ChatRole, string> = {
  orders: "TELEGRAM_BOT_ORDERS",
  delivery: "TELEGRAM_BOT_DELIVERY",
  payments: "TELEGRAM_BOT_PAYMENTS",
};

const CHAT_ENV: Record<ChatRole, string> = {
  orders: "TELEGRAM_CHAT_ORDERS",
  delivery: "TELEGRAM_CHAT_DELIVERY",
  payments: "TELEGRAM_CHAT_PAYMENTS",
};

export function botToken(role: ChatRole): string | null {
  return process.env[TOKEN_ENV[role]] || null;
}

export function isTelegramEnabled(role: ChatRole): boolean {
  return Boolean(botToken(role) && chatId(role));
}

export function chatId(role: ChatRole): string | null {
  return process.env[CHAT_ENV[role]] || null;
}

/** Совпадает ли группа, из которой пришло нажатие, с настроенной для роли. */
export function isKnownChat(role: ChatRole, id: string | number): boolean {
  return chatId(role) === String(id);
}

export type InlineButton = { text: string; callback_data: string } | { text: string; url: string };

class TelegramError extends Error {}

async function call<T>(role: ChatRole, method: string, body: unknown): Promise<T> {
  const token = botToken(role);
  if (!token) throw new TelegramError(`Бот «${role}» не настроен: нет ${TOKEN_ENV[role]}`);

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new TelegramError(`${method}: ${data.description ?? response.status}`);
  return data.result as T;
}

export type SentMessage = { message_id: number };

/**
 * Сообщение в группу. Разметка — HTML: в названиях товаров попадаются
 * скобки и дефисы, на которых Markdown у Телеграма спотыкается.
 */
export async function sendMessage(
  role: ChatRole,
  text: string,
  buttons: InlineButton[][] = [],
): Promise<SentMessage | null> {
  const chat = chatId(role);
  if (!isTelegramEnabled(role) || !chat) return null;

  return call<SentMessage>(role, "sendMessage", {
    chat_id: chat,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

/** Картинка с подписью — так уходит QR-код на оплату. */
export async function sendPhoto(
  role: ChatRole,
  photo: Buffer,
  caption: string,
  fileName = "qr.png",
): Promise<SentMessage | null> {
  const token = botToken(role);
  const chat = chatId(role);
  if (!token || !chat) return null;

  const form = new FormData();
  form.append("chat_id", chat);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), fileName);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as { ok: boolean; result?: SentMessage; description?: string };
  if (!data.ok) throw new TelegramError(`sendPhoto: ${data.description ?? response.status}`);
  return data.result ?? null;
}

/**
 * Ответ на нажатие кнопки. Телеграм крутит часики на кнопке, пока не
 * получит его, поэтому отвечать нужно всегда — даже когда действие не
 * удалось.
 */
export async function answerCallback(
  role: ChatRole,
  id: string,
  text: string,
  alert = false,
): Promise<void> {
  if (!botToken(role)) return;
  await call(role, "answerCallbackQuery", {
    callback_query_id: id,
    text: text.slice(0, 200),
    show_alert: alert,
  }).catch(() => undefined);
}

/** Убрать кнопки у сообщения — действие уже сделано, повторять нечего. */
export async function clearButtons(
  role: ChatRole,
  chat: string | number,
  messageId: number,
): Promise<void> {
  if (!botToken(role)) return;
  await call(role, "editMessageReplyMarkup", {
    chat_id: chat,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => undefined);
}

/**
 * Переписать сообщение на месте — так меню не плодит новые сообщения:
 * список заказов и карточка живут в одном и том же.
 */
export async function editMessage(
  role: ChatRole,
  chat: string | number,
  messageId: number,
  text: string,
  buttons: InlineButton[][] = [],
): Promise<void> {
  if (!botToken(role)) return;
  await call(role, "editMessageText", {
    chat_id: chat,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: buttons },
  }).catch((error) => {
    // «Ничего не изменилось» — не ошибка: так Телеграм отвечает на
    // повторное нажатие той же кнопки.
    if (!String(error).includes("message is not modified")) throw error;
  });
}
