/**
 * Можно ли оплатить заказ картой прямо сейчас.
 *
 * Заказ с оплатой при получении переходит в онлайн только тогда, когда
 * деньги не собирает СДЭК: иначе покупатель заплатил бы дважды — картой
 * на сайте и курьеру при вручении. Так бывает, когда доставку забрали
 * себе: отправления нет, наложенного платежа тоже, и чек выбить некому
 * — оплата картой его и выбивает.
 */
export function canPayOnline(order: {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  cdek: unknown | null;
}): boolean {
  if (order.status === "cancelled" || order.paymentStatus === "paid") return false;
  return order.paymentMethod === "online" || order.cdek === null;
}
