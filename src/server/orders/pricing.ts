import type { Order, OrderItem } from "@/lib/types";

/**
 * Позиция заказа с ценой за единицу уже после скидки.
 *
 * Скидка по промокоду хранится одной суммой на заказ, а чек по 54-ФЗ и
 * наложенный платёж СДЭК требуют цену каждой единицы — и чтобы сумма
 * позиций сходилась с суммой заказа рубль в рубль.
 */
export type SettledLine = {
  item: OrderItem;
  /** Цена за единицу после скидки, в рублях. */
  unitPrice: number;
  quantity: number;
  /**
   * Порядковый номер части, если позицию пришлось разбить: например,
   * 3 пары по 4 000 ₽ со скидкой 100 ₽ — это 2 пары по 3 967 и 1 по 3 966.
   */
  part: number;
};

export function settledLines(
  order: Pick<Order, "items" | "subtotal" | "discount">,
): SettledLine[] {
  const { items, subtotal, discount } = order;
  const lines: SettledLine[] = [];
  let allocated = 0;

  items.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    // Доля скидки пропорциональна стоимости позиции; остаток от округления
    // достаётся последней — так сумма долей равна скидке без хвостов.
    const share =
      index === items.length - 1
        ? discount - allocated
        : subtotal > 0
          ? Math.floor((discount * lineTotal) / subtotal)
          : 0;
    allocated += share;

    const lineAfter = lineTotal - share;
    const unit = Math.floor(lineAfter / item.quantity);
    const remainder = lineAfter - unit * item.quantity;

    // remainder единиц стоят на рубль дороже — иначе сумма не сойдётся.
    if (item.quantity - remainder > 0) {
      lines.push({ item, unitPrice: unit, quantity: item.quantity - remainder, part: 1 });
    }
    if (remainder > 0) {
      lines.push({ item, unitPrice: unit + 1, quantity: remainder, part: 2 });
    }
  });

  return lines;
}
