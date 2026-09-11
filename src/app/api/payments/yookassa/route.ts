import { NextResponse } from "next/server";

import { applyPayment, applyRefund } from "@/server/payments/flow";
import { getYookassaPayment, isYookassaEnabled, YookassaError } from "@/server/payments/yookassa";

/**
 * Вебхук ЮKassa. Адрес задаётся в личном кабинете магазина:
 * https://<сайт>/api/payments/yookassa
 *
 * Тело уведомления не считается источником правды: подделать POST на
 * открытый адрес может кто угодно. Из уведомления берётся только
 * идентификатор платежа, а его состояние запрашивается у ЮKassa заново
 * по авторизованному каналу. Поэтому проверка IP-адресов отправителя не
 * нужна — за спуфинг адреса за обратным прокси она бы всё равно не
 * поручилась, а за подделку тела ручается сам повторный запрос.
 *
 * Ответ всегда 200 для уведомлений, которые разобраны: при любом другом
 * коде ЮKassa будет повторять доставку сутки.
 */
type Notification = {
  type?: string;
  event?: string;
  object?: { id?: string; payment_id?: string };
};

export async function POST(request: Request) {
  if (!isYookassaEnabled()) {
    return NextResponse.json({ error: "Оплата не настроена" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Notification | null;
  const event = body?.event ?? "";
  const objectId = body?.object?.id;

  if (!objectId || !event.includes(".")) {
    return NextResponse.json({ error: "Не похоже на уведомление ЮKassa" }, { status: 400 });
  }

  try {
    if (event.startsWith("payment.")) {
      const remote = await getYookassaPayment(objectId);
      const payment = applyPayment(remote);
      // Одна строка в журнал: по ней видно, что уведомления доходят,
      // и какой заказ они закрыли.
      console.log(`Вебхук ЮKassa: ${event} ${objectId} → ${payment ? `платёж ${payment.id}, ${payment.status}` : "не наш"}`);
    } else if (event === "refund.succeeded" && body?.object?.payment_id) {
      applyRefund(body.object.payment_id);
    }
    // Остальные события (например, payout) нас не касаются — подтверждаем,
    // чтобы ЮKassa не слала их снова.
  } catch (error) {
    // Платежа с таким id у ЮKassa нет — значит, уведомление не наше.
    // Подтверждаем, иначе его будут присылать сутки.
    if (error instanceof YookassaError && error.status === 404) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    console.error(`Вебхук ЮKassa: не удалось обработать ${event} ${objectId}:`, error);
    // Временная ошибка — пусть ЮKassa повторит.
    return NextResponse.json({ error: "Повторите позже" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
