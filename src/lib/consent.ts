/**
 * Согласие на cookies.
 *
 * Имя куки и правило «куда можно» лежат отдельно от серверного кода:
 * их читает и proxy.ts, который работает в другой среде и серверные
 * модули импортировать не может.
 *
 * Сам выбор тоже хранится в куке — иначе вопрос задавался бы на каждой
 * странице. Это техническая кука, без неё согласие негде запомнить.
 */
export const CONSENT_COOKIE = "ugg_cookies";

export type Consent = "accepted" | "declined";

/** Согласие помним год, отказ — месяц: вдруг решение изменится. */
export const CONSENT_MAX_AGE = {
  accepted: 60 * 60 * 24 * 365,
  declined: 60 * 60 * 24 * 30,
} as const;

/**
 * Что открыто посетителю, отказавшемуся от cookies: главная и политика
 * конфиденциальности. Всё остальное — каталог, корзина, кабинет —
 * уводит на главную: без куки там нечего показать, а корзину и вход
 * нечем запомнить.
 */
const ALLOWED_WHEN_DECLINED = ["/", "/politika-konfidentsialnosti"];

export function isAllowedWhenDeclined(pathname: string): boolean {
  return ALLOWED_WHEN_DECLINED.includes(pathname);
}
