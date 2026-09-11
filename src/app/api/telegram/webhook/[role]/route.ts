import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { formatPrice } from "@/lib/utils";
import { completeOrder } from "@/server/orders/lifecycle";
import { selfDelivery } from "@/server/orders/self-delivery";
import { cancelShipment } from "@/server/orders/shipment";
import { startPayment } from "@/server/payments/flow";
import { getOrderById } from "@/server/repositories/orders";
import {
  activeDeliveryOrders,
  deliveryCard,
  escape,
  paymentCard,
  type Card,
} from "@/server/telegram/cards";
import {
  answerCallback,
  botToken,
  chatId,
  clearButtons,
  editMessage,
  isKnownChat,
  sendMessage,
  sendPhoto,
  CHAT_ROLES,
  type ChatRole,
  type InlineButton,
} from "@/server/telegram/client";
import { notifyCancelled, notifyDelivery, notifyPayments } from "@/server/telegram/notify";

/**
 * Разговор с ботами в группах.
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
 * Кто что может, решает группа, а не нажавший: курьерам — меню, вручение,
 * отмена и просьба выставить QR; группе оплаты — сам QR; администраторам
 * — забрать доставку себе. Запрос подписан секретом из настроек, а
 * идентификатор чата Телеграм подставляет сам — подделать его нельзя.
 */

const ACTIONS: Record<ChatRole, string[]> = {
  delivery: ["open", "menu", "list", "show", "done", "cancel", "askqr"],
  payments: ["qr"],
  orders: ["self"],
};

type Chat = { id: number };

type Callback = {
  id: string;
  data?: string;
  message?: { message_id: number; chat: Chat };
  from?: { first_name?: string; username?: string };
};

type Message = { message_id: number; chat: Chat; text?: string };

const ok = () => NextResponse.json({ ok: true });

/** Корень меню. Пока пункт один, но место для следующих уже есть. */
function rootMenu(): Card {
  return {
    text: "📋 <b>Меню</b>\nВыберите раздел.",
    buttons: [[{ text: "Заказы", callback_data: "list" }]],
  };
}

/**
 * Список заказов кнопками: номер и сумма, по две в ряд.
 *
 * Номер на кнопке, а не в тексте: нажимать по списку удобнее, чем искать
 * команду, и курьеру не нужно ничего печатать на морозе.
 */
function orderList(): Card {
  const orders = activeDeliveryOrders();
  if (orders.length === 0) {
    return { text: "Активных заказов на доставку нет.", buttons: [[{ text: "⟵ Меню", callback_data: "menu" }]] };
  }

  const buttons: InlineButton[][] = [];
  for (let i = 0; i < orders.length; i += 2) {
    buttons.push(
      orders.slice(i, i + 2).map((order) => ({
        text: `${order.number} · ${formatPrice(order.total)}`,
        callback_data: `show:${order.id}`,
      })),
    );
  }
  buttons.push([{ text: "⟵ Меню", callback_data: "menu" }]);

  return { text: `🚚 <b>Заказы на доставку</b> — ${orders.length}`, buttons };
}

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

  const update = (await request.json().catch(() => null)) as
    | { callback_query?: Callback; message?: Message }
    | null;

  // Команда в группе: /menu открывает меню. Остальное бот не слышит —
  // режим приватности отдаёт ему только команды.
  const message = update?.message;
  if (message?.text && isKnownChat(role, message.chat.id)) {
    const command = message.text.trim().split(/[\s@]/)[0].toLowerCase();
    if (role === "delivery" && (command === "/menu" || command === "/start")) {
      const menu = rootMenu();
      await sendMessage(role, menu.text, menu.buttons);
    }
    return ok();
  }

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

  const chat = callback.message.chat.id;
  const messageId = callback.message.message_id;
  const who = callback.from?.username
    ? `@${callback.from.username}`
    : (callback.from?.first_name ?? "кто-то");

  try {
    // Кнопка из закреплённого сообщения: его переписывать нельзя, оно
    // висит в шапке группы, — поэтому меню открывается новым сообщением.
    if (action === "open") {
      const menu = rootMenu();
      await sendMessage(role, menu.text, menu.buttons);
      await answerCallback(role, callback.id, "");
      return ok();
    }

    // Меню и список ничего не меняют — просто переписывают сообщение.
    if (action === "menu" || action === "list") {
      const card = action === "menu" ? rootMenu() : orderList();
      await editMessage(role, chat, messageId, card.text, card.buttons);
      await answerCallback(role, callback.id, "");
      return ok();
    }

    const order = getOrderById(orderId ?? "");
    if (!order) {
      await answerCallback(role, callback.id, "Заказ не найден", true);
      return ok();
    }

    if (action === "show") {
      const card = deliveryCard(order);
      await editMessage(role, chat, messageId, card.text, [
        ...card.buttons,
        [{ text: "⟵ К списку", callback_data: "list" }],
      ]);
      await answerCallback(role, callback.id, "");
      return ok();
    }

    if (action === "done") {
      const done = completeOrder(order.id);
      if (!done) {
        await answerCallback(role, callback.id, "Заказ отменён — отметить вручение нельзя", true);
        return ok();
      }
      await clearButtons(role, chat, messageId);
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
      await clearButtons(role, chat, messageId);
      await answerCallback(role, callback.id, "Отменён, товары вернулись в каталог");
      notifyCancelled(order, who);
      return ok();
    }

    // Курьер на месте: покупатель хочет платить картой. Сам QR курьеру
    // недоступен — просьба уходит в группу оплаты, оттуда вернётся
    // картинка.
    if (action === "askqr") {
      if (order.paymentStatus === "paid") {
        await answerCallback(role, callback.id, "Заказ уже оплачен", true);
        return ok();
      }
      if (!chatId("payments")) {
        await answerCallback(role, callback.id, "Группа оплаты не подключена", true);
        return ok();
      }
      notifyPayments(order, true);
      await answerCallback(role, callback.id, "Запросили QR — администратор сейчас выставит счёт");
      return ok();
    }

    if (action === "self") {
      const result = await selfDelivery(order.id);
      if (!result.ok) {
        await answerCallback(role, callback.id, result.error, true);
        return ok();
      }
      await clearButtons(role, chat, messageId);
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
      const caption = [
        `💳 <b>Заказ ${escape(order.number)}</b> — ${formatPrice(order.total)}`,
        "Покажите QR покупателю: оплата картой, чек придёт ему на почту.",
        "Ссылка действует около часа.",
      ].join("\n");

      await sendPhoto("payments", png, caption, `qr-${order.number}.png`);
      // И сразу курьеру — просил он, платить будут у него на глазах.
      if (chatId("delivery")) {
        await sendPhoto("delivery", png, caption, `qr-${order.number}.png`).catch((error) =>
          console.error(`Телеграм: QR курьеру ${order.number}:`, error),
        );
      }

      // Сообщение с кнопкой остаётся, но уже без неё: счёт выставлен,
      // второй раз нажимать незачем.
      const card = paymentCard(order);
      await editMessage(role, chat, messageId, `${card.text}\n\n📨 Счёт выставлен, QR отправлен`, []);
      await answerCallback(role, callback.id, "QR отправлен");
      return ok();
    }
  } catch (error) {
    console.error(`Телеграм: не удалось выполнить ${callback.data}:`, error);
    await answerCallback(role, callback.id, "Не получилось. Попробуйте ещё раз", true);
  }

  return ok();
}
