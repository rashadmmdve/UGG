import "server-only";

/**
 * Телеграм: низкоуровневые вызовы Bot API.
 *
 * Бот один, а групп три — по одной на роль: заказы для администраторов,
 * доставка для курьеров, оплата для тех, кто выставляет QR. Куда писать,
 * решает не бот, а вызывающий код: у каждой группы свой идентификатор в
 * настройках, и сообщение уходит ровно в ту, которой оно адресовано.
 *
 * Без настроек бот молчит: ни токена, ни групп — ни одного запроса.
 * Магазин от этого не ломается, просто уведомлений нет.
 */

export type ChatRole = "orders" | "delivery" | "payments";

const CHAT_ENV: Record<ChatRole, string> = {
  orders: "TELEGRAM_CHAT_ORDERS",
  delivery: "TELEGRAM_CHAT_DELIVERY",
  payments: "TELEGRAM_CHAT_PAYMENTS",
};

export function isTelegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function chatId(role: ChatRole): string | null {
  return process.env[CHAT_ENV[role]] || null;
}

/** Роль группы по её идентификатору — чтобы проверять, откуда пришло нажатие. */
export function roleOfChat(id: string | number): ChatRole | null {
  const value = String(id);
  for (const role of Object.keys(CHAT_ENV) as ChatRole[]) {
    if (chatId(role) === value) return role;
  }
  return null;
}

export type InlineButton = { text: string; callback_data: string } | { text: string; url: string };

class TelegramError extends Error {}

async function call<T>(method: string, body: unknown): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError("Бот не настроен: нет TELEGRAM_BOT_TOKEN");

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
  if (!isTelegramEnabled() || !chat) return null;

  return call<SentMessage>("sendMessage", {
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
  const token = process.env.TELEGRAM_BOT_TOKEN;
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
export async function answerCallback(id: string, text: string, alert = false): Promise<void> {
  if (!isTelegramEnabled()) return;
  await call("answerCallbackQuery", {
    callback_query_id: id,
    text: text.slice(0, 200),
    show_alert: alert,
  }).catch(() => undefined);
}

/** Убрать кнопки у сообщения — действие уже сделано, повторять нечего. */
export async function clearButtons(chat: string | number, messageId: number): Promise<void> {
  if (!isTelegramEnabled()) return;
  await call("editMessageReplyMarkup", {
    chat_id: chat,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => undefined);
}

/** Для наладки: последние обновления — по ним находятся id групп. */
export async function getUpdates(): Promise<unknown[]> {
  return call<unknown[]>("getUpdates", { limit: 50, allowed_updates: ["message", "callback_query"] });
}

/** Подписка на обновления. Секрет Телеграм присылает заголовком при каждом запросе. */
export async function setWebhook(url: string, secret: string): Promise<void> {
  await call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["callback_query"],
    drop_pending_updates: true,
  });
}
