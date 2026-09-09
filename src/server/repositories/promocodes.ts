import "server-only";

import { nanoid } from "nanoid";

import { getDb } from "@/server/db/connection";
import { mapPromocode, toInt, type PromocodeRow } from "@/server/db/mappers";
import type { Promocode } from "@/lib/types";

const normalizeCode = (code: string): string => code.trim().toUpperCase();

export function getPromocodes(): Promocode[] {
  const rows = getDb()
    .prepare("SELECT * FROM promocodes ORDER BY code")
    .all() as PromocodeRow[];
  return rows.map(mapPromocode);
}

export function getPromocodeByCode(code: string): Promocode | null {
  const row = getDb()
    .prepare("SELECT * FROM promocodes WHERE code = ?")
    .get(normalizeCode(code)) as PromocodeRow | undefined;
  return row ? mapPromocode(row) : null;
}

export function getPromocodeById(id: string): Promocode | null {
  const row = getDb()
    .prepare("SELECT * FROM promocodes WHERE id = ?")
    .get(id) as PromocodeRow | undefined;
  return row ? mapPromocode(row) : null;
}

export type PromocodeCheck =
  | { ok: true; promocode: Promocode; discount: number }
  | { ok: false; error: string };

/**
 * Проверка промокода и расчёт скидки.
 *
 * Чистая функция без обращения к базе: её вызывают дважды — при вводе кода
 * в форме и ещё раз при оформлении заказа. Второй раз обязателен, потому
 * что между вводом и отправкой формы код мог кончиться или истечь.
 *
 * Скидка считается только от суммы товаров: на доставку она не переносится.
 */
export function checkPromocode(
  promocode: Promocode | null,
  subtotal: number,
): PromocodeCheck {
  if (!promocode || !promocode.isActive) {
    return { ok: false, error: "Промокод не найден" };
  }

  if (promocode.expiresAt && new Date(promocode.expiresAt) < new Date()) {
    return { ok: false, error: "Срок действия промокода истёк" };
  }

  if (
    promocode.usageLimit !== null &&
    promocode.usedCount >= promocode.usageLimit
  ) {
    return { ok: false, error: "Промокод больше не действует" };
  }

  if (subtotal < promocode.minOrderTotal) {
    return {
      ok: false,
      error: `Промокод действует от ${promocode.minOrderTotal.toLocaleString("ru-RU")} ₽`,
    };
  }

  const discount =
    promocode.type === "percent"
      ? Math.round((subtotal * promocode.value) / 100)
      : Math.min(promocode.value, subtotal);

  return { ok: true, promocode, discount };
}

export function savePromocode(
  input: Omit<Promocode, "id" | "usedCount"> & { id?: string },
): Promocode {
  const db = getDb();
  const code = normalizeCode(input.code);

  if (input.id) {
    // usedCount намеренно не трогаем: счётчик использований ведёт система,
    // а не администратор.
    db.prepare(
      `UPDATE promocodes
       SET code = ?, type = ?, value = ?, min_order_total = ?,
           expires_at = ?, usage_limit = ?, is_active = ?
       WHERE id = ?`,
    ).run(
      code,
      input.type,
      input.value,
      input.minOrderTotal,
      input.expiresAt,
      input.usageLimit,
      toInt(input.isActive),
      input.id,
    );
    return getPromocodeById(input.id)!;
  }

  const id = nanoid(12);
  db.prepare(
    `INSERT INTO promocodes
       (id, code, type, value, min_order_total, expires_at, usage_limit, used_count, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    id,
    code,
    input.type,
    input.value,
    input.minOrderTotal,
    input.expiresAt,
    input.usageLimit,
    toInt(input.isActive),
  );

  return getPromocodeById(id)!;
}

export function deletePromocode(id: string): void {
  getDb().prepare("DELETE FROM promocodes WHERE id = ?").run(id);
}

export function incrementPromocodeUsage(id: string): void {
  getDb()
    .prepare("UPDATE promocodes SET used_count = used_count + 1 WHERE id = ?")
    .run(id);
}
