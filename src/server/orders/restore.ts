import "server-only";

import { decreaseStock } from "@/server/repositories/catalog";
import { getOrderById, patchOrder } from "@/server/repositories/orders";
import type { Order } from "@/lib/types";

/**
 * Вернуть отменённый заказ в работу.
 *
 * Отмена вернула товары в каталог, и за это время их могли купить —
 * поэтому восстановление начинается с попытки снова их списать. Не
 * хватило хотя бы одной пары: заказ остаётся отменённым, иначе магазин
 * пообещал бы то, чего нет.
 *
 * Отправление в СДЭК не воскресает: оно удалено у них насовсем, и
 * создавать новое нужно кнопкой «Передать в СДЭК» — уже осознанно.
 * Оплату возвращаем в «не оплачен»: деньги, если они были, отмена не
 * трогала, и «оплачен» сохраняется как есть.
 */
export type RestoreResult = { ok: true; order: Order } | { ok: false; error: string };

export function restoreOrder(orderId: string): RestoreResult {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.status !== "cancelled") return { ok: false, error: "Заказ и так в работе" };

  try {
    decreaseStock(
      order.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    );
  } catch {
    return {
      ok: false,
      error: "Товаров уже не хватает на складе — восстановить заказ нельзя.",
    };
  }

  const updated = patchOrder(orderId, {
    status: order.paymentStatus === "paid" ? "confirmed" : "new",
    paymentStatus: order.paymentStatus === "paid" ? "paid" : "unpaid",
  });

  return updated
    ? { ok: true, order: updated }
    : { ok: false, error: "Не удалось сохранить заказ" };
}
