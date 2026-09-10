import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";

/**
 * Название магазина. Пока это заглушка: собственное имя бренда ещё не
 * выбрано. Оно попадёт в шаблоны заголовков, в разметку Organization и
 * в подвал, поэтому меняется ровно здесь.
 */
export const SITE_NAME = "UGG";

export const SITE_DESCRIPTION =
  "Угги, тапочки и аксессуары UGG® с доставкой по России. " +
  "Женские, мужские и детские модели, обмен и возврат 14 дней.";

/**
 * Дисклеймер о независимости от правообладателя. Выводится в подвале
 * каждой страницы — он отличает независимый магазин от того, кто выдаёт
 * себя за официальное представительство. Формулировку менять только
 * вместе с юристом.
 */
export const TRADEMARK_DISCLAIMER =
  "Сайт не является официальным представительством Deckers Outdoor Corporation. " +
  "UGG® — зарегистрированный товарный знак Deckers Outdoor Corporation.";

/**
 * Базовый адрес сайта: канонические ссылки, sitemap, абсолютные адреса
 * картинок в разметке.
 *
 * В продакшене отсутствие переменной — это ошибка сборки, а не повод
 * подставить localhost. Молчаливый fallback на localhost отравляет
 * canonical и sitemap так, что поисковик выкидывает сайт из индекса,
 * а заметно это становится через недели.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL не задан. Без него канонические ссылки и sitemap " +
          "будут указывать на localhost. Пропишите домен в переменных окружения.",
      );
    }
    return "http://localhost:3000";
  }

  // Без завершающего слэша — во всём проекте адреса склеиваются как `${SITE_URL}/path`.
  return raw.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl();

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  shipped: "Отправлен",
  completed: "Выполнен",
  cancelled: "Отменён",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Не оплачен",
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  refunded: "Возвращён",
  canceled: "Отменён",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online: "Картой онлайн",
  on_delivery: "При получении",
};

/** Товаров на странице каталога. Страницы со второй закрыты от индексации. */
export const PRODUCTS_PER_PAGE = 48;

/**
 * Разделы каталога — первый сегмент адреса вида /catalog/zhenskie/classic-mini.
 * Набор фиксированный: это часть структуры URL, а не редактируемый справочник.
 */
export const SECTIONS = [
  { slug: "zhenskie", title: "Женские", gender: "women" },
  { slug: "muzhskie", title: "Мужские", gender: "men" },
  { slug: "detskie", title: "Детские", gender: "kids" },
  { slug: "aksessuary", title: "Аксессуары", gender: "accessory" },
] as const;

export type SectionSlug = (typeof SECTIONS)[number]["slug"];

/**
 * Слаги, которые нельзя занять категорией или товаром: они уже что-то
 * значат в маршрутизации. Проверяется в админке при сохранении.
 */
export const RESERVED_SLUGS = new Set<string>([
  ...SECTIONS.map((section) => section.slug),
  "catalog",
  "product",
  "collection",
  "articles",
  "search",
  "cart",
  "checkout",
  "account",
  "favorites",
  "admin",
  "api",
  "sitemap",
  "robots",
  "feed",
]);
