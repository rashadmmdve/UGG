import "server-only";

import { nanoid } from "nanoid";

import { getDb } from "@/server/db/connection";
import { nowIso } from "@/server/db/mappers";

/**
 * Курьеры своей доставки.
 *
 * Отдельная таблица, а не роль пользователя: курьеру не нужен вход на
 * сайт, он живёт в Телеграме. Всё, что о нём знает магазин, — имя,
 * телефон и идентификатор в Телеграме, по которому бот отличает «его»
 * заказы от чужих.
 */
export type Courier = {
  id: string;
  name: string;
  phone: string;
  telegramId: string;
  isActive: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  name: string;
  phone: string;
  telegram_id: string;
  is_active: number;
  created_at: string;
};

const map = (row: Row): Courier => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  telegramId: row.telegram_id,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
});

export function getCouriers(): Courier[] {
  const rows = getDb()
    .prepare("SELECT * FROM couriers ORDER BY is_active DESC, name")
    .all() as Row[];
  return rows.map(map);
}

export function getCourierById(id: string): Courier | null {
  const row = getDb().prepare("SELECT * FROM couriers WHERE id = ?").get(id) as Row | undefined;
  return row ? map(row) : null;
}

/** Курьер по идентификатору в Телеграме — так бот узнаёт нажавшего. */
export function getCourierByTelegramId(telegramId: string | number): Courier | null {
  const value = String(telegramId);
  if (!value) return null;
  const row = getDb()
    .prepare("SELECT * FROM couriers WHERE telegram_id = ? AND is_active = 1")
    .get(value) as Row | undefined;
  return row ? map(row) : null;
}

export function createCourier(input: {
  name: string;
  phone: string;
  telegramId: string;
}): Courier {
  const courier: Courier = {
    id: nanoid(12),
    name: input.name,
    phone: input.phone,
    telegramId: input.telegramId,
    isActive: true,
    createdAt: nowIso(),
  };

  getDb()
    .prepare(
      `INSERT INTO couriers (id, name, phone, telegram_id, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    )
    .run(courier.id, courier.name, courier.phone, courier.telegramId, courier.createdAt);

  return courier;
}

export function updateCourier(
  id: string,
  patch: Partial<Pick<Courier, "name" | "phone" | "telegramId" | "isActive">>,
): Courier | null {
  const existing = getCourierById(id);
  if (!existing) return null;

  const next = { ...existing, ...patch };
  getDb()
    .prepare(
      `UPDATE couriers SET name = ?, phone = ?, telegram_id = ?, is_active = ? WHERE id = ?`,
    )
    .run(next.name, next.phone, next.telegramId, next.isActive ? 1 : 0, id);

  return next;
}

/** Удаляем только вместе с историей: у заказов остаётся ссылка. */
export function deleteCourier(id: string): void {
  getDb().prepare("DELETE FROM couriers WHERE id = ?").run(id);
  getDb().prepare("UPDATE orders SET courier_id = NULL WHERE courier_id = ?").run(id);
}
