"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/server/admin/guard";
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

export async function refreshShipmentAction(orderId: string): Promise<void> {
  if (!(await assertAdmin())) return;
  await syncShipment(orderId);
  refreshOrderPages(orderId);
}
