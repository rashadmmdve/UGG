import "server-only";

import { isSelfDelivery } from "@/lib/delivery";
import { formatPrice } from "@/lib/utils";
import { getCouriers } from "@/server/repositories/couriers";
import { getOrders } from "@/server/repositories/orders";
import { composition, escape, phoneLink, where } from "@/server/telegram/cards";
import { sendMessage } from "@/server/telegram/client";
import type { Order } from "@/lib/types";

/**
 * Утренний список курьеру.
 *
 * Оператор за день раздал заказы, а утром каждый курьер получает свой
 * список одним сообщением — с адресами, телефонами и суммами к
 * получению. Это ровно то, с чем он выходит из дома; искать заказы по
 * меню ему уже не нужно.
 *
 * Уходит в группу доставки, по сообщению на курьера: личных чатов с
 * ботом у курьеров нет, а в группе каждый находит своё по имени.
 * Заказы без курьера — отдельным сообщением: оператор их ещё не раздал,
 * и утром это должно быть видно.
 */
export type DispatchResult = { couriers: number; orders: number; unassigned: number };

function inWork(order: Order): boolean {
  return (
    isSelfDelivery(order.delivery) &&
    order.status !== "cancelled" &&
    order.status !== "completed"
  );
}

function line(order: Order): string {
  const due =
    order.paymentStatus === "paid"
      ? "оплачен"
      : `к получению ${formatPrice(order.total)}`;
  return [
    `<b>${escape(order.number)}</b> — ${due}`,
    where(order),
    `${escape(order.customer.name)} · ${phoneLink(order.customer.phone)}`,
    composition(order),
    order.comment ? `💬 ${escape(order.comment)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function dispatchToCouriers(): Promise<DispatchResult> {
  const orders = getOrders().filter(inWork);
  const couriers = getCouriers().filter((courier) => courier.isActive);

  let sent = 0;
  let count = 0;

  for (const courier of couriers) {
    const mine = orders.filter((order) => order.courierId === courier.id);
    if (mine.length === 0) continue;

    const text = [
      `🚚 <b>${escape(courier.name)}</b>, на сегодня ${mine.length} ${plural(mine.length)}:`,
      "",
      mine.map(line).join("\n\n"),
    ].join("\n");

    await sendMessage("delivery", text);
    sent += 1;
    count += mine.length;
  }

  const unassigned = orders.filter((order) => !order.courierId);
  if (unassigned.length) {
    await sendMessage(
      "delivery",
      [
        `⚠️ <b>Без курьера: ${unassigned.length}</b> — оператору нужно раздать.`,
        unassigned.map((order) => `• ${escape(order.number)} — ${where(order)}`).join("\n"),
      ].join("\n"),
    );
  }

  return { couriers: sent, orders: count, unassigned: unassigned.length };
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "заказ";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "заказа";
  return "заказов";
}
