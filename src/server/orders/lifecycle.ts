import "server-only";

import { getOrderById, patchOrder, updateOrderStatus } from "@/server/repositories/orders";
import type { Order } from "@/lib/types";

/**
 * Заказ вручён.
 *
 * Деньги по заказу «при получении» появляются ровно в этот момент: наш
 * курьер берёт наличные, курьер СДЭК — наложенный платёж. Поэтому отметка
 * о вручении заодно закрывает оплату, и не важно, откуда её поставили —
 * из админки или кнопкой в группе курьеров.
 */
export function completeOrder(orderId: string): Order | null {
  const order = getOrderById(orderId);
  if (!order || order.status === "cancelled") return null;

  updateOrderStatus(orderId, "completed");
  if (order.paymentMethod === "on_delivery" && order.paymentStatus !== "paid") {
    patchOrder(orderId, { paymentStatus: "paid" });
  }

  return getOrderById(orderId);
}
