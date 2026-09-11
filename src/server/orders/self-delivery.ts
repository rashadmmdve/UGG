import "server-only";

import { isSelfDelivery } from "@/lib/delivery";
import { deleteCdekOrder } from "@/server/cdek/api";
import { isMailEnabled, sendMail } from "@/server/mail/mailer";
import { deliveryChangedMail } from "@/server/mail/templates";
import { canCancel } from "@/server/orders/shipment";
import { getOrderById, setSelfDelivery } from "@/server/repositories/orders";
import type { Order } from "@/lib/types";

/**
 * Забрать доставку себе.
 *
 * Для городов рядом со складом дешевле отвезти самим, чем платить СДЭК.
 * Отправление удаляется, доставка из заказа уходит, сумма уменьшается —
 * при наложенном платеже покупатель отдаст курьеру меньше, чем ожидал,
 * поэтому ему сразу уходит письмо с новой суммой.
 *
 * Оплаченный заказ так переключать нельзя: деньги за доставку уже взяты,
 * и их пришлось бы возвращать через ЮKassa.
 *
 * Живёт отдельно от действий админки: то же самое делает кнопка в группе
 * Телеграма, и расходиться этим двум путям нельзя.
 */
export type SelfDeliveryResult = { ok: true; order: Order } | { ok: false; error: string };

export async function selfDelivery(orderId: string): Promise<SelfDeliveryResult> {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.status === "cancelled") return { ok: false, error: "Заказ отменён" };
  if (isSelfDelivery(order.delivery)) return { ok: false, error: "Этот заказ и так везём сами" };
  if (order.paymentStatus === "paid") {
    return {
      ok: false,
      error: "Заказ оплачен — доставка уже в платеже. Сначала верните её стоимость в ЮKassa.",
    };
  }

  if (order.cdek) {
    if (!canCancel(order)) {
      return { ok: false, error: "Посылка уже принята в СДЭК — отменить её можно только через поддержку." };
    }
    if (!(await deleteCdekOrder(order.cdek.uuid))) {
      return { ok: false, error: "СДЭК не дал удалить отправление. Попробуйте позже." };
    }
  }

  const deliveryWas = order.deliveryPrice;
  const updated = setSelfDelivery(orderId);
  if (!updated) return { ok: false, error: "Не удалось сохранить заказ" };

  if (isMailEnabled() && deliveryWas > 0) {
    sendMail(deliveryChangedMail(updated, deliveryWas)).catch((error) =>
      console.error(`Не удалось сообщить об изменении доставки ${updated.number}:`, error),
    );
  }

  return { ok: true, order: updated };
}
