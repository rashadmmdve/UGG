import "server-only";

import {
  createCdekOrder,
  deleteCdekOrder,
  getCdekBarcodeUrl,
  type CdekLabelResult,
  getCdekOrderStatus,
} from "@/server/cdek/api";
import { restoreStock } from "@/server/repositories/catalog";
import { getOrderById, patchOrder } from "@/server/repositories/orders";
import { getPaymentsByOrderId, updatePaymentStatus } from "@/server/repositories/payments";
import type { Order, OrderStatus } from "@/lib/types";

/**
 * Работа с отправлением в СДЭК: статус, отмена, этикетка.
 *
 * Логика общая для личного кабинета и админки — правила отмены и перевода
 * статусов должны совпадать, иначе покупатель и менеджер увидят разное.
 */

/**
 * Коды СДЭК, после которых посылка уже физически в сети перевозчика.
 * С этого момента отменить заказ через API нельзя — только через поддержку.
 */
const HANDED_OVER_CODES = new Set([
  "RECEIVED_AT_SHIPMENT_WAREHOUSE",
  "ACCEPTED_AT_SHIPMENT_WAREHOUSE",
  "READY_TO_SHIP_AT_SENDING_OFFICE",
  "TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY",
  "SENT_TO_TRANSIT_CITY",
  "ACCEPTED_IN_TRANSIT_CITY",
  "SENT_TO_RECIPIENT_CITY",
  "ACCEPTED_IN_RECIPIENT_CITY",
  "ACCEPTED_AT_PICK_UP_POINT",
  "TAKEN_BY_COURIER",
  "DELIVERED",
]);

/** Код СДЭК, означающий, что покупатель забрал заказ. */
const DELIVERED_CODE = "DELIVERED";

/** Можно ли ещё отменить заказ — и покупателю, и менеджеру. */
export function canCancel(order: Order): boolean {
  if (order.status === "cancelled" || order.status === "completed") return false;
  // Не передан в СДЭК — отменяем свободно.
  if (!order.cdek) return true;
  return !HANDED_OVER_CODES.has(order.cdek.statusCode);
}

/**
 * Спросить у СДЭК текущий статус и сохранить его.
 *
 * Заодно переводит наш статус заказа: «отправлен», когда посылка ушла в
 * сеть, и «выполнен», когда покупатель её забрал.
 */
export async function syncShipment(orderId: string): Promise<Order | null> {
  const order = getOrderById(orderId);
  if (!order?.cdek) return order;

  const status = await getCdekOrderStatus(order.cdek.uuid).catch(() => null);
  if (!status) return order;

  const patch: Partial<Pick<Order, "status" | "paymentStatus" | "cdek">> = {
    cdek: {
      ...order.cdek,
      cdekNumber: status.cdekNumber ?? order.cdek.cdekNumber,
      statusCode: status.statusCode,
      statusName: status.statusName,
      syncedAt: new Date().toISOString(),
    },
  };

  // Отменённые вручную заказы статусом СДЭК не трогаем.
  if (order.status !== "cancelled") {
    let next: OrderStatus = order.status;
    if (status.statusCode === DELIVERED_CODE) next = "completed";
    else if (HANDED_OVER_CODES.has(status.statusCode)) next = "shipped";
    if (next !== order.status) patch.status = next;

    // Вручили — значит наложенный платёж собран: СДЭК не отдаёт посылку,
    // не получив денег. Отметка об оплате не ждёт менеджера.
    if (
      status.statusCode === DELIVERED_CODE &&
      order.paymentMethod === "on_delivery" &&
      order.paymentStatus !== "paid"
    ) {
      patch.paymentStatus = "paid";
    }
  }

  return patchOrder(orderId, patch);
}

export type CancelResult = { ok: true } | { ok: false; error: string };

/**
 * Отмена заказа. Возвращает остатки в каталог и удаляет отправление
 * в СДЭК, если оно было создано.
 */
export async function cancelShipment(orderId: string): Promise<CancelResult> {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.status === "cancelled") return { ok: true };

  if (!canCancel(order)) {
    return {
      ok: false,
      error: "Посылка уже принята в СДЭК — отменить можно только через поддержку.",
    };
  }

  if (order.cdek) {
    const deleted = await deleteCdekOrder(order.cdek.uuid);
    if (!deleted) {
      return {
        ok: false,
        error: "СДЭК не дал отменить отправление. Попробуйте позже.",
      };
    }
  }

  // Товары снова доступны к покупке.
  restoreStock(
    order.items.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  );

  // Оплату тоже закрываем: заказ с выставленным счётом иначе остался бы
  // «ожидает оплаты» навсегда. Оплаченный не трогаем — деньги настоящие,
  // их нужно вернуть, и статус об этом напоминает.
  const paymentStatus = order.paymentStatus === "paid" ? order.paymentStatus : "canceled";
  for (const payment of getPaymentsByOrderId(orderId)) {
    if (payment.status === "pending") updatePaymentStatus(payment.externalId, "canceled");
  }

  patchOrder(orderId, { status: "cancelled", paymentStatus, cdek: null });
  return { ok: true };
}

export type RegisterResult =
  | { ok: true; order: Order }
  | { ok: false; error: string };

/** Передать заказ в СДЭК вручную — если автоматическая регистрация не прошла. */
export async function registerShipment(orderId: string): Promise<RegisterResult> {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.cdek) return { ok: true, order };

  const created = await createCdekOrder(order);
  if (!created.ok) return { ok: false, error: created.error };

  const status = await getCdekOrderStatus(created.uuid).catch(() => null);

  const updated = patchOrder(orderId, {
    cdek: {
      uuid: created.uuid,
      cdekNumber: status?.cdekNumber ?? null,
      statusCode: status?.statusCode ?? "CREATED",
      statusName: status?.statusName ?? "Создан",
      syncedAt: new Date().toISOString(),
    },
  });

  return updated
    ? { ok: true, order: updated }
    : { ok: false, error: "Не удалось сохранить отправление" };
}

/** Ссылка на PDF с этикеткой. */
export type ShipmentLabel = CdekLabelResult | { ok: false; reason: "no-shipment" };

export async function getShipmentLabel(orderId: string): Promise<ShipmentLabel> {
  const order = getOrderById(orderId);
  if (!order?.cdek) return { ok: false, reason: "no-shipment" };
  return getCdekBarcodeUrl(order.cdek.uuid).catch(
    (): ShipmentLabel => ({ ok: false, reason: "pending" }),
  );
}
