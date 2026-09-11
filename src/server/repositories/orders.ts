import "server-only";

import { nanoid } from "nanoid";

import { getDb, transaction } from "@/server/db/connection";
import { mapOrder, nowIso, type OrderRow } from "@/server/db/mappers";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";

/** Префикс номера заказа, который видит покупатель. */
/**
 * Префикс номера заказа. Латинские буквы, а не кириллица: СДЭК
 * принимает номер заказа только в ASCII («может содержать только цифры,
 * буквы латинского алфавита или спецсимволы»), и «ИМ» он отклонил бы.
 */
const ORDER_PREFIX = "IM";

/**
 * Дата в номере — «зеркальная»: сначала месяц наоборот, потом день.
 * 12 сентября → «90» + «12» = 9012.
 *
 * День считается по московскому времени: сервер живёт по UTC, и заказ,
 * оформленный ночью, иначе попал бы во вчерашний день.
 */
function orderDay(now: Date): { key: string; mirror: string } {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day");
  const month = part("month");
  return {
    key: `${part("year")}-${month}-${day}`,
    mirror: `${[...month].reverse().join("")}${day}`,
  };
}

/**
 * Следующий номер заказа: IM-0019012 — три цифры счётчика за текущий
 * день и четыре цифры «зеркальной» даты.
 *
 * Счётчик свой на каждый день и хранится отдельной строкой, а не
 * считается как количество заказов за сутки: при подсчёте строк
 * удаление любого заказа приводит к тому, что следующий получит уже
 * занятый номер.
 *
 * Больше 999 заказов за день — номер станет на цифру длиннее, но
 * останется уникальным; ломать нумерацию ради формата не стоит.
 *
 * Инкремент и чтение идут одной транзакцией — иначе два одновременных
 * оформления получили бы один номер.
 */
function nextOrderNumber(): string {
  const { key, mirror } = orderDay(new Date());
  const counter = `order:${key}`;

  return transaction(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO counters (name, value) VALUES (?, 1)
       ON CONFLICT(name) DO UPDATE SET value = value + 1`,
    ).run(counter);
    const row = db
      .prepare("SELECT value FROM counters WHERE name = ?")
      .get(counter) as { value: number };
    return `${ORDER_PREFIX}-${String(row.value).padStart(3, "0")}${mirror}`;
  });
}

export function getOrders(): Order[] {
  const rows = getDb()
    .prepare("SELECT * FROM orders ORDER BY created_at DESC")
    .all() as OrderRow[];
  return rows.map(mapOrder);
}

export function getOrderById(id: string): Order | null {
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(id) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function getOrderByNumber(number: string): Order | null {
  const row = getDb()
    .prepare("SELECT * FROM orders WHERE number = ?")
    .get(number) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

export function getOrdersByUserId(userId: string): Order[] {
  const rows = getDb()
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as OrderRow[];
  return rows.map(mapOrder);
}

export type NewOrder = Omit<
  Order,
  "id" | "number" | "createdAt" | "updatedAt"
>;

export function createOrder(input: NewOrder): Order {
  const now = nowIso();
  const order: Order = {
    ...input,
    id: nanoid(12),
    number: nextOrderNumber(),
    createdAt: now,
    updatedAt: now,
  };

  getDb()
    .prepare(
      `INSERT INTO orders
         (id, number, user_id, customer, delivery, comment, items,
          subtotal, discount, delivery_price, package_weight, total,
          promocode, status, payment_method, payment_status, cdek,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      order.id,
      order.number,
      order.userId,
      JSON.stringify(order.customer),
      JSON.stringify(order.delivery),
      order.comment,
      JSON.stringify(order.items),
      order.subtotal,
      order.discount,
      order.deliveryPrice,
      order.packageWeight,
      order.total,
      order.promocode,
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      order.cdek ? JSON.stringify(order.cdek) : null,
      order.createdAt,
      order.updatedAt,
    );

  return order;
}

export function updateOrderStatus(id: string, status: OrderStatus): void {
  getDb()
    .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, nowIso(), id);
}

export function updateOrderPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
): void {
  getDb()
    .prepare("UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?")
    .run(paymentStatus, nowIso(), id);
}

/** Частичное обновление заказа — статусы, данные отправления. */
export function patchOrder(
  id: string,
  patch: Partial<Pick<Order, "status" | "paymentStatus" | "cdek" | "comment">>,
): Order | null {
  const existing = getOrderById(id);
  if (!existing) return null;

  const next: Order = { ...existing, ...patch, updatedAt: nowIso() };

  getDb()
    .prepare(
      `UPDATE orders
       SET status = ?, payment_status = ?, cdek = ?, comment = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.status,
      next.paymentStatus,
      next.cdek ? JSON.stringify(next.cdek) : null,
      next.comment,
      next.updatedAt,
      id,
    );

  return next;
}
