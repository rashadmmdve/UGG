/**
 * Города, куда магазин возит сам.
 *
 * Такой заказ не передаётся в СДЭК: трек-номера у него нет, и покупателю
 * вместо «ждите отправление» пишем, что свяжемся и согласуем доставку.
 * Код города — из справочника СДЭК: 44 — Москва.
 *
 * Способ оплаты на это не влияет: и оплаченный картой, и наложенный
 * платёж в своём городе одинаково собираются вручную. Наложенного
 * платежа в таком заказе тоже нет — деньги берёт свой курьер.
 */
export const SELF_DELIVERY_CITY_CODES = new Set([44]);

export function isSelfDelivery(delivery: {
  cityCode: number;
  selfDelivery?: boolean;
}): boolean {
  return delivery.selfDelivery === true || SELF_DELIVERY_CITY_CODES.has(delivery.cityCode);
}
