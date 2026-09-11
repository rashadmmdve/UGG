import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { formatPrice } from "@/lib/utils";
import { completeOrder } from "@/server/orders/lifecycle";
import { cancelShipment } from "@/server/orders/shipment";
import { startPayment } from "@/server/payments/flow";
import { getOrderById } from "@/server/repositories/orders";
import { selfDelivery } from "@/server/orders/self-delivery";
import {
  answerCallback,
  botToken,
  clearButtons,
  isKnownChat,
  sendPhoto,
  CHAT_ROLES,
  type ChatRole,
} from "@/server/telegram/client";
import { notifyCancelled, notifyDelivery } from "@/server/telegram/notify";

/**
 * Нажатия кнопок в группах Телеграма.
 *
 * У каждой группы свой бот, поэтому и адрес свой: роль стоит в пути —
 * /api/telegram/webhook/delivery и так далее. По ней выбирается токен,
 * которым отвечать, и проверяется, из своей ли группы пришло нажатие.
 *
 * Телеграм шлёт сюда каждое нажатие и ждёт ответа: пока его нет, на
 * кнопке крутятся часики. Поэтому отвечаем всегда — и на успех, и на
 * отказ, — а тяжёлую работу делаем до ответа, чтобы человек видел
 * результат, а не «готово», за которым ничего не произошло.
 *
 * Кто что может, решает группа, а не нажавший: курьерам — вручение и
 * отмена, группе оплаты — QR, администраторам — забрать доставку себе.
 * Запрос подписан секретом из настроек, а идентификатор чата Телеграм
 * подставляет сам — подделать его нельзя.
 */

const ACTIONS: Record<ChatRole, string[]> = {
  delivery: ["done", "cancel"],
  payments: ["qr"],
  orders: ["self"],
};

type Callback = {
  id: string;
  data?: string;
  message?: { message_id: number; chat: { id: number } };
  from?: { first_name?: string; username?: string };
};

const ok = () => NextResponse.json({ ok: true });

export async function POST(
  request: Request,
  context: RouteContext<"/api/telegram/webhook/[role]">,
): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Не наш запрос" }, { status: 401 });
  }

  const { role: raw } = await context.params;
  const role = CHAT_ROLES.find((item) => item === raw);
  if (!role || !botToken(role)) {
    return NextResponse.json({ error: "Такой группы нет" }, { status: 404 });
  }

  const update = (await request.json().catch(() => null)) as { callback_query?: Callback } | null;
  const callback = update?.callback_query;
  if (!callback?.data || !callback.message) return ok();

  if (!isKnownChat(role, callback.message.chat.id)) {
    await answerCallback(role, callback.id, "Эта группа не подключена к магазину", true);
    return ok();
  }

  const [action, orderId] = callback.data.split(":");
  if (!ACTIONS[role].includes(action)) {
    await answerCallback(role, callback.id, "Здесь это действие недоступно", true);
    return ok();
  }

  const order = getOrderById(orderId ?? "");
  if (!order) {
    await answerCallback(role, callback.id, "Заказ не найден", true);
    return ok();
  }

  const who = callback.from?.username ? `@${callback.from.username}` : (callback.from?.first_name ?? "кто-то");

  try {
    if (action === "done") {
      const done = completeOrder(order.id);
      if (!done) {
        await answerCallback(role, callback.id, "Заказ отменён — отметить вручение нельзя", true);
        return ok();
      }
      await clearButtons(role, callback.message.chat.id, callback.message.message_id);
      await answerCallback(
        role,
        callback.id,
        done.paymentStatus === "paid" && order.paymentStatus !== "paid"
          ? `Вручён, оплата ${formatPrice(done.total)} принята`
          : "Вручён",
      );
      return ok();
    }

    if (action === "cancel") {
      const result = await cancelShipment(order.id);
      if (!result.ok) {
        await answerCallback(role, callback.id, result.error, true);
        return ok();
      }
      await clearButtons(role, callback.message.chat.id, callback.message.message_id);
      await answerCallback(role, callback.id, "Отменён, товары вернулись в каталог");
      notifyCancelled(order, who);
      return ok();
    }

    if (action === "self") {
      const result = await selfDelivery(order.id);
      if (!result.ok) {
        await answerCallback(role, callback.id, result.error, true);
        return ok();
      }
      await clearButtons(role, callback.message.chat.id, callback.message.message_id);
      await answerCallback(role, callback.id, "Везём сами: доставка убрана, покупателю ушло письмо");
      notifyDelivery(result.order);
      return ok();
    }

    if (action === "qr") {
      const payment = await startPayment(order);
      if (!payment.ok) {
        await answerCallback(role, callback.id, payment.error, true);
        return ok();
      }
      // QR кодирует ту же ссылку, по которой платят с сайта: покупатель
      // наводит камеру и попадает на страницу оплаты ЮKassa.
      const png = await QRCode.toBuffer(payment.url, { width: 600, margin: 2 });
      await sendPhoto(
        "payments",
        png,
        [
          `💳 <b>Заказ ${order.number}</b> — ${formatPrice(order.total)}`,
          "Покажите QR покупателю: оплата картой, чек придёт ему на почту.",
          "Ссылка действует около часа.",
        ].join("\n"),
        `qr-${order.number}.png`,
      );
      await answerCallback(role, callback.id, "QR отправлен");
      return ok();
    }
  } catch (error) {
    console.error(`Телеграм: не удалось выполнить ${callback.data}:`, error);
    await answerCallback(role, callback.id, "Не получилось. Попробуйте ещё раз", true);
  }

  return ok();
}
