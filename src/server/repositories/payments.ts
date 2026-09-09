import "server-only";

import { nanoid } from "nanoid";

import { getDb } from "@/server/db/connection";
import { mapPayment, nowIso, type PaymentRow } from "@/server/db/mappers";
import type { Payment, PaymentStatus } from "@/lib/types";

/**
 * Платежи ЮKassa.
 *
 * Хранятся отдельно от заказа ради идемпотентности: уведомление о платеже
 * приходит по вебхуку и может прийти несколько раз. Запись платежа —
 * то место, по которому повторную доставку уведомления видно и можно
 * не обрабатывать её дважды.
 */

export function getPaymentByExternalId(externalId: string): Payment | null {
  const row = getDb()
    .prepare("SELECT * FROM payments WHERE external_id = ?")
    .get(externalId) as PaymentRow | undefined;
  return row ? mapPayment(row) : null;
}

export function getPaymentsByOrderId(orderId: string): Payment[] {
  const rows = getDb()
    .prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC")
    .all(orderId) as PaymentRow[];
  return rows.map(mapPayment);
}

export function createPayment(input: {
  externalId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  idempotenceKey: string;
  confirmationUrl: string | null;
}): Payment {
  const now = nowIso();
  const payment: Payment = { ...input, id: nanoid(12), createdAt: now, updatedAt: now };

  getDb()
    .prepare(
      `INSERT INTO payments
         (id, external_id, order_id, amount, status, idempotence_key,
          confirmation_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payment.id,
      payment.externalId,
      payment.orderId,
      payment.amount,
      payment.status,
      payment.idempotenceKey,
      payment.confirmationUrl,
      payment.createdAt,
      payment.updatedAt,
    );

  return payment;
}

export function updatePaymentStatus(
  externalId: string,
  status: PaymentStatus,
): Payment | null {
  getDb()
    .prepare("UPDATE payments SET status = ?, updated_at = ? WHERE external_id = ?")
    .run(status, nowIso(), externalId);
  return getPaymentByExternalId(externalId);
}
