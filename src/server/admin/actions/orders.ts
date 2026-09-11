"use server";

import { revalidatePath } from "next/cache";

import { isSelfDelivery } from "@/lib/delivery";
import { assertAdmin } from "@/server/admin/guard";
import { deleteCdekOrder } from "@/server/cdek/api";
import { isMailEnabled, sendMail } from "@/server/mail/mailer";
import { deliveryChangedMail } from "@/server/mail/templates";
import {
  canCancel,
  cancelShipment,
  registerShipment,
  syncShipment,
  type CancelResult,
} from "@/server/orders/shipment";
import { getProductById } from "@/server/repositories/catalog";
import {
  getOrderById,
  setSelfDelivery,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from "@/server/repositories/orders";
import { revalidateProduct } from "@/server/seo/revalidate";
import { orderStatusSchema } from "@/server/validation/schemas";
import type { Order, PaymentStatus } from "@/lib/types";

/**
 * Действия по заказам.
 *
 * Страницы админки динамические, но после серверного действия Next
 * перерисовывает маршрут только при вызове revalidatePath — без него
 * менеджер не увидит изменения, пока не обновит страницу вручную.
 */
function refreshOrderPages(orderId: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
}

/** Остатки заказа влияют на наличие в карточках — сбрасываем их кэш. */
function revalidateOrderProducts(order: Order): void {
  const seen = new Set<string>();
  for (const item of order.items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    const product = getProductById(item.productId);
    if (product) revalidateProduct(product);
  }
}

/**
 * Смена статуса вручную.
 *
 * Отмена сюда не входит: она возвращает остатки и удаляет отправление,
 * и делается отдельным действием. Отменённый заказ обратно не переводится —
 * его остатки уже вернулись в каталог, и повторно списать их нельзя.
 */
export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const parsed = orderStatusSchema.safeParse(formData.get("status"));
  if (!parsed.success || parsed.data === "cancelled") return;

  const order = getOrderById(id);
  if (!order || order.status === "cancelled") return;

  updateOrderStatus(id, parsed.data);
  refreshOrderPages(id);
}

const PAYMENT_STATUSES = new Set<PaymentStatus>(["unpaid", "pending", "paid", "refunded"]);

/** Ручная отметка об оплате — для перевода на карту или наличных при получении. */
export async function updatePaymentStatusAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("paymentStatus") ?? "") as PaymentStatus;
  if (!PAYMENT_STATUSES.has(status) || !getOrderById(id)) return;

  updateOrderPaymentStatus(id, status);
  refreshOrderPages(id);
}

export async function cancelOrderAction(orderId: string): Promise<CancelResult> {
  if (!(await assertAdmin())) return { ok: false, error: "Нет доступа" };

  const result = await cancelShipment(orderId);
  if (result.ok) {
    const order = getOrderById(orderId);
    if (order) revalidateOrderProducts(order);
    refreshOrderPages(orderId);
  }
  return result;
}

export async function registerShipmentAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertAdmin())) return { ok: false, error: "Нет доступа" };

  const result = await registerShipment(orderId);
  if (!result.ok) return result;

  refreshOrderPages(orderId);
  return { ok: true };
}

/**
 * Взять доставку на себя.
 *
 * Для городов рядом со своим складом дешевле отвезти самим, чем платить
 * СДЭК. Отправление при этом удаляется, доставка из заказа уходит, а
 * сумма уменьшается — при наложенном платеже покупатель отдаст курьеру
 * меньше, чем ожидал, поэтому ему сразу уходит письмо.
 *
 * Оплаченный картой заказ так переключать нельзя: деньги за доставку уже
 * взяты, и их пришлось бы возвращать через ЮKassa.
 */
export async function selfDeliveryAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertAdmin())) return { ok: false, error: "Нет доступа" };

  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.status === "cancelled") return { ok: false, error: "Заказ отменён" };
  if (isSelfDelivery(order.delivery)) {
    return { ok: false, error: "Этот заказ и так везём сами" };
  }
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

  refreshOrderPages(orderId);
  return { ok: true };
}

export async function refreshShipmentAction(orderId: string): Promise<void> {
  if (!(await assertAdmin())) return;
  await syncShipment(orderId);
  refreshOrderPages(orderId);
}
