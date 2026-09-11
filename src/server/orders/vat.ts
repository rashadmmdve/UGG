import "server-only";

/**
 * Ставка НДС магазина — одна на оба чека.
 *
 * Чек покупателю пробивает либо ЮKassa (оплата картой), либо СДЭК
 * (наложенный платёж), и ставка в них обязана совпадать. Поэтому ставка
 * задаётся одним числом в процентах — VAT_RATE, — а каждый из них
 * получает её в своём виде: ЮKassa хочет код ставки, СДЭК — проценты.
 *
 * 0 или пусто — «без НДС». Для ИП на УСН со специальной ставкой это 5
 * или 7; общая ставка с 2026 года — 22.
 */
export const VAT_RATE = Number(process.env.VAT_RATE ?? 0);

/** Код ставки для чека ЮKassa (vat_code). 1 — «без НДС». */
const YOOKASSA_VAT_CODES: Record<number, number> = {
  0: 1,
  10: 3,
  20: 4,
  5: 7,
  7: 8,
  22: 11,
};

export function yookassaVatCode(): number {
  return YOOKASSA_VAT_CODES[VAT_RATE] ?? 1;
}

/**
 * Ставка для позиций накладной СДЭК: проценты или null — «нет НДС».
 * Ставку, которой СДЭК не знает, не отправляем: заказ с неизвестным
 * значением он отклонит целиком, а без НДС хотя бы уедет.
 */
const CDEK_VAT_RATES = new Set([0, 5, 7, 10, 12, 20, 22]);

export function cdekVatRate(): number | null {
  return CDEK_VAT_RATES.has(VAT_RATE) && VAT_RATE > 0 ? VAT_RATE : null;
}
