"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin, assertStaff } from "@/server/admin/guard";
import {
  createCourier,
  deleteCourier,
  getCourierById,
  updateCourier,
} from "@/server/repositories/couriers";
import { getOrderById, setOrderCourier } from "@/server/repositories/orders";
import { notifyDelivery } from "@/server/telegram/notify";

/**
 * Курьеры и раздача заказов.
 *
 * Справочник ведёт владелец: курьер — это доступ к телефонам и адресам
 * покупателей, и заводить его оператор не должен. А вот раздавать заказы
 * между курьерами — ровно работа оператора, поэтому назначение доступно
 * и ему.
 */

type Result = { ok: true } | { ok: false; error: string };

function refresh(): void {
  revalidatePath("/admin/couriers");
  revalidatePath("/admin/orders");
}

export async function saveCourierAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const telegramId = String(formData.get("telegramId") ?? "").replace(/\D/g, "");
  const isActive = formData.get("isActive") === "on";

  if (!name) return;

  if (id) updateCourier(id, { name, phone, telegramId, isActive });
  else createCourier({ name, phone, telegramId });

  refresh();
}

export async function deleteCourierAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  if (id) deleteCourier(id);

  refresh();
}

/**
 * Отдать заказ курьеру. Пустое значение — снять назначение.
 *
 * Назначенному курьеру заказ сразу приходит в группу доставки: иначе он
 * узнал бы о нём, только открыв меню.
 */
export async function assignCourierAction(
  orderId: string,
  courierId: string | null,
): Promise<Result> {
  if (!(await assertStaff())) return { ok: false, error: "Нет доступа" };

  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (courierId && !getCourierById(courierId)) {
    return { ok: false, error: "Курьер не найден" };
  }

  const updated = setOrderCourier(orderId, courierId);
  if (!updated) return { ok: false, error: "Не удалось сохранить" };

  if (courierId) notifyDelivery(updated);

  revalidatePath(`/admin/orders/${orderId}`);
  refresh();
  return { ok: true };
}
