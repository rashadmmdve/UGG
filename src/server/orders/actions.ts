"use server";

import { revalidatePath } from "next/cache";

import { getCurrentCustomer } from "@/server/auth/session";
import { cancelShipment, syncShipment } from "@/server/orders/shipment";
import { getProductById } from "@/server/repositories/catalog";
import { getOrderById } from "@/server/repositories/orders";
import { revalidateProduct } from "@/server/seo/revalidate";
import type { Order } from "@/lib/types";

/**
 * Действия личного кабинета.
 *
 * Каждое проверяет, что заказ принадлежит текущему покупателю: действия
 * доступны прямым POST-запросом, и без проверки чужой заказ можно было бы
 * отменить, зная только его идентификатор.
 */
async function ownedOrder(orderId: string): Promise<Order | null> {
  const user = await getCurrentCustomer();
  if (!user) return null;

  const order = getOrderById(orderId);
  if (!order || order.userId !== user.id) return null;

  return order;
}

/** Свежий статус доставки — вызывается опросом с открытой страницы. */
export async function refreshOrderStatusAction(orderId: string) {
  const order = await ownedOrder(orderId);
  if (!order) return null;

  const updated = await syncShipment(orderId);
  if (!updated) return null;

  return {
    status: updated.status,
    statusCode: updated.cdek?.statusCode ?? null,
    statusName: updated.cdek?.statusName ?? null,
    cdekNumber: updated.cdek?.cdekNumber ?? null,
  };
}

export async function cancelOrderAction(orderId: string) {
  const order = await ownedOrder(orderId);
  if (!order) return { ok: false as const, error: "Заказ не найден" };

  const result = await cancelShipment(orderId);
  if (result.ok) {
    revalidatePath("/account");
    // Остатки вернулись — наличие в карточках изменилось.
    for (const item of order.items) {
      const product = getProductById(item.productId);
      if (product) revalidateProduct(product);
    }
  }

  return result;
}
