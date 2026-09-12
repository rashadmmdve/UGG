"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin, assertStaff } from "@/server/admin/guard";
import { completeOrder } from "@/server/orders/lifecycle";
import { restoreOrder } from "@/server/orders/restore";
import { selfDelivery } from "@/server/orders/self-delivery";
import {
  cancelShipment,
  registerShipment,
  syncShipment,
  type CancelResult,
} from "@/server/orders/shipment";
import { getProductById } from "@/server/repositories/catalog";
import {
  getOrderById,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from "@/server/repositories/orders";
import { notifyCancelled, notifyRestored } from "@/server/telegram/notify";
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
  if (!(await assertStaff())) return;

  const id = String(formData.get("id") ?? "");
  const parsed = orderStatusSchema.safeParse(formData.get("status"));
  if (!parsed.success || parsed.data === "cancelled") return;

  const order = getOrderById(id);
  if (!order || order.status === "cancelled") return;

  // «Выполнен» — это вручение, а вручение закрывает оплату при
  // получении: см. completeOrder, им же пользуется кнопка у курьеров.
  if (parsed.data === "completed") completeOrder(id);
  else updateOrderStatus(id, parsed.data);

  refreshOrderPages(id);
}

const PAYMENT_STATUSES = new Set<PaymentStatus>(["unpaid", "pending", "paid", "refunded"]);

/** Ручная отметка об оплате — для перевода на карту или наличных при получении. */
export async function updatePaymentStatusAction(formData: FormData): Promise<void> {
  if (!(await assertStaff())) return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("paymentStatus") ?? "") as PaymentStatus;
  if (!PAYMENT_STATUSES.has(status) || !getOrderById(id)) return;

  updateOrderPaymentStatus(id, status);
  refreshOrderPages(id);
}

export async function cancelOrderAction(orderId: string, reason: string): Promise<CancelResult> {
  const staff = await assertStaff();
  if (!staff) return { ok: false, error: "Нет доступа" };
  if (!reason.trim()) return { ok: false, error: "Укажите причину отмены" };

  const order = getOrderById(orderId);
  const result = await cancelShipment(orderId, `${reason.trim()} — ${staff.name || staff.email}`);
  if (result.ok) {
    if (order) {
      revalidateOrderProducts(order);
      notifyCancelled(order, "админка");
    }
    refreshOrderPages(orderId);
  }
  return result;
}

export async function registerShipmentAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertStaff())) return { ok: false, error: "Нет доступа" };

  const result = await registerShipment(orderId);
  if (!result.ok) return result;

  refreshOrderPages(orderId);
  return { ok: true };
}

/**
 * Вернуть отменённый заказ в работу.
 *
 * Только из админки и с подтверждением: отмена вернула товары в каталог,
 * и восстановление снова их списывает — если их успели раскупить,
 * действие честно откажет.
 */
export async function restoreOrderAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Только владелец: восстановление снова списывает товар со склада, и
  // отменять-возвращать заказ по кругу оператору незачем.
  if (!(await assertAdmin())) return { ok: false, error: "Нет доступа" };

  const result = restoreOrder(orderId);
  if (!result.ok) return result;

  revalidateOrderProducts(result.order);
  notifyRestored(result.order, "админка");
  refreshOrderPages(orderId);
  return { ok: true };
}

/** Взять доставку на себя — то же делает кнопка в группе Телеграма. */
export async function selfDeliveryAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await assertStaff())) return { ok: false, error: "Нет доступа" };

  const result = await selfDelivery(orderId);
  if (!result.ok) return result;

  refreshOrderPages(orderId);
  return { ok: true };
}

export async function refreshShipmentAction(orderId: string): Promise<void> {
  if (!(await assertStaff())) return;
  await syncShipment(orderId);
  refreshOrderPages(orderId);
}
