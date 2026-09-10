import "server-only";

import { sizeLabel } from "@/lib/utils";
import { settledLines } from "@/server/orders/pricing";
import type { Order, PaymentStatus } from "@/lib/types";

/**
 * Клиент API ЮKassa.
 *
 * Авторизация — Basic по паре «идентификатор магазина : секретный ключ».
 * Создание платежа обязано идти с ключом идемпотентности: при обрыве
 * связи запрос повторяется с тем же ключом, и ЮKassa вернёт уже созданный
 * платёж, а не заведёт второй.
 *
 * Адрес API переопределяется переменной окружения только ради локальных
 * проверок с подставным сервером — в бою он один.
 */
const API_URL = process.env.YOOKASSA_API_URL ?? "https://api.yookassa.ru";

/** Ошибка API с кодом ответа: вебхуку важно отличать «нет такого платежа» от сбоя. */
export class YookassaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "YookassaError";
  }
}

/** Пока ключи не заданы, онлайн-оплаты на сайте нет — и это не ошибка. */
export function isYookassaEnabled(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) {
    throw new Error("YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY не заданы (см. .env.example).");
  }
  return `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
}

/** Сумма в формате ЮKassa: строка с двумя знаками после точки. */
const money = (rub: number) => ({ value: rub.toFixed(2), currency: "RUB" });

export type YookassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
};

/** Статус ЮKassa → наш. Захват средств автоматический, waiting_for_capture — переходный. */
export function toPaymentStatus(status: YookassaPayment["status"]): PaymentStatus {
  switch (status) {
    case "succeeded":
      return "paid";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotenceKey?: string } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.idempotenceKey ? { "Idempotence-Key": init.idempotenceKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | (T & { type?: string; code?: string; description?: string })
    | null;

  if (!response.ok || !data) {
    const reason = data?.description ?? data?.code ?? `HTTP ${response.status}`;
    throw new YookassaError(`ЮKassa: ${reason}`, response.status);
  }
  return data;
}

/**
 * Чек по 54-ФЗ. Формируется ЮKassa, если в личном кабинете магазина
 * включены чеки. Ставка НДС — из окружения: ИП на упрощёнке — «без НДС».
 */
function receipt(order: Order) {
  const vatCode = Number(process.env.YOOKASSA_VAT_CODE ?? 1);
  const items = settledLines(order).map((line) => ({
    description: (sizeLabel(line.item.sizeEu)
      ? `${line.item.title}, размер ${line.item.sizeEu}`
      : line.item.title
    ).slice(0, 128),
    quantity: line.quantity.toFixed(2),
    amount: money(line.unitPrice),
    vat_code: vatCode,
    payment_subject: "commodity",
    payment_mode: "full_payment",
  }));

  if (order.deliveryPrice > 0) {
    items.push({
      description: "Доставка",
      quantity: "1.00",
      amount: money(order.deliveryPrice),
      vat_code: vatCode,
      payment_subject: "service",
      payment_mode: "full_payment",
    });
  }

  return {
    customer: {
      email: order.customer.email,
      phone: order.customer.phone.replace(/[^\d]/g, ""),
    },
    items,
  };
}

/**
 * Создать платёж. ЮKassa отвечает адресом страницы оплаты, куда уходит
 * покупатель; итог придёт вебхуком и его же можно спросить по id.
 */
export async function createYookassaPayment(input: {
  order: Order;
  returnUrl: string;
  idempotenceKey: string;
}): Promise<YookassaPayment> {
  const { order } = input;
  const sendReceipt = process.env.YOOKASSA_RECEIPT !== "0";

  return request<YookassaPayment>("/v3/payments", {
    method: "POST",
    idempotenceKey: input.idempotenceKey,
    body: {
      amount: money(order.total),
      capture: true,
      confirmation: { type: "redirect", return_url: input.returnUrl },
      description: `Заказ ${order.number}`,
      metadata: { orderId: order.id, orderNumber: order.number },
      ...(sendReceipt ? { receipt: receipt(order) } : {}),
    },
  });
}

export function getYookassaPayment(id: string): Promise<YookassaPayment> {
  return request<YookassaPayment>(`/v3/payments/${encodeURIComponent(id)}`);
}
