/**
 * Модель данных магазина.
 *
 * Единственный источник правды по формам сущностей: репозитории отдают
 * ровно эти типы, страницы и админка работают только с ними. Хранилище
 * (SQLite) прячется за слоем репозиториев и в типах не отражается.
 */

/** Пол/назначение товара. Определяет, в какой раздел каталога он попадает. */
export type Gender = "women" | "men" | "kids" | "unisex";

/** Сезонность — используется в фильтрах и в описании карточки. */
export type Season = "winter" | "demi" | "summer" | "home";

/** Материал верха либо подкладки. */
export type Material = "ovchina" | "zamsha" | "kozha" | "vyazanyj" | "tekstil";

// ─────────────────────────────────────────────────────────────────────────────
// Справочники каталога
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Поля метатегов, которые можно переопределить вручную для любой
 * индексируемой страницы. Пустые значения означают «собрать по шаблону».
 */
export type SeoFields = {
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
  /** Текст под сеткой товаров либо под описанием. Разметка — ограниченный HTML. */
  seoText?: string;
  /** Ручное закрытие страницы от индексации. */
  noindex?: boolean;
};

/**
 * Категория каталога — второй сегмент адреса: /catalog/{section}/{category}.
 *
 * Раздел (`sectionSlug`) не хранится отдельной сущностью: набор разделов
 * фиксирован в constants.ts, потому что это часть структуры URL.
 */
export type Category = {
  id: string;
  slug: string;
  sectionSlug: string;
  title: string;
  /** Короткое название для меню, если полное слишком длинное. */
  shortTitle?: string;
  description: string;
  image: string | null;
  order: number;
  isPublished: boolean;
  /**
   * Прежние адреса и синонимы: `korotkie-uggi` → эта категория.
   * Отдаются 301-редиректом, а не отдельной страницей, — иначе спрос
   * расщепляется между двумя конкурирующими URL.
   */
  aliases: string[];
  seo: SeoFields;
  createdAt: string;
  updatedAt: string;
};

/**
 * Модельная линия UGG: Classic Mini, Tasman, Neumel и так далее.
 * Отдельная сущность, потому что одна линия живёт сразу в нескольких
 * разделах (Classic Mini есть женский, мужской и детский), а размерная
 * сетка привязана именно к линии.
 */
export type ModelLine = {
  id: string;
  slug: string;
  title: string;
  description: string;
  genders: Gender[];
  sizeChartId: string | null;
  order: number;
};

/**
 * Цвет как сущность, а не свободный текст. Без этого невозможны
 * посадочные страницы вида /catalog/zhenskie/classic-mini/chernye:
 * «Black», «Onyx» и «Чёрный» должны схлопываться в одну группу.
 */
export type Color = {
  id: string;
  /** Слаг группы, попадающий в адрес посадочной страницы: `chernye`. */
  slug: string;
  /** Название конкретного оттенка, как у производителя: `Metallic Black`. */
  title: string;
  /** Группа для фильтра: несколько оттенков сворачиваются в один цвет. */
  group: string;
  hex: string;
};

/** Строка размерной сетки: соответствие систем и длина стельки. */
export type SizeChartRow = {
  sizeEu: number;
  sizeUs?: string;
  sizeUk?: string;
  /** Длина стельки в сантиметрах — главный ориентир при выборе. */
  insoleCm: number;
};

export type SizeChart = {
  id: string;
  slug: string;
  title: string;
  gender: Gender;
  rows: SizeChartRow[];
};

/**
 * Меню шапки: раздел и его категории. Собирается на сервере в макете
 * витрины, чтобы клиентской шапке не нужно было знать про хранилище.
 */
export type MenuSection = {
  slug: string;
  title: string;
  href: string;
  categories: {
    slug: string;
    title: string;
    href: string;
    /** false — категория пока пустая; в меню показывается приглушённо. */
    hasProducts: boolean;
  }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Товары
// ─────────────────────────────────────────────────────────────────────────────

export type ProductVariant = {
  id: string;
  /** Размер в европейской системе — основной для российского покупателя. */
  sizeEu: number;
  /** Длина стельки в см для этого размера. */
  insoleCm: number | null;
  stock: number;
  barcode?: string;
  /**
   * Код маркировки «Честный ЗНАК». Обувь подлежит обязательной маркировке:
   * код передаётся в чек и выводится из оборота при продаже. Сама интеграция
   * появится позже, но поле заложено сразу — иначе придётся переделывать
   * структуру заказа, когда в нём уже будут реальные продажи.
   */
  markingCode?: string;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  /** Артикул производителя. */
  sku: string | null;
  description: string;

  gender: Gender;
  modelLineId: string | null;
  colorId: string | null;

  /**
   * Товар принадлежит нескольким категориям сразу: одна пара честно
   * является и `classic-mini`, и `na-platforme`, и `rasprodazha`.
   * Поэтому связь множественная, а для хлебных крошек и родителя в
   * канонической ссылке берётся `primaryCategoryId`.
   */
  categoryIds: string[];
  primaryCategoryId: string | null;

  /** Связывает цветовые вариации одной модели — блок «другие цвета». */
  groupId: string | null;

  materials: Material[];
  seasons: Season[];
  /** Высота голенища и каблука в сантиметрах — параметры карточки. */
  shaftHeightCm: number | null;
  heelHeightCm: number | null;

  /** Цена в рублях, целое число. */
  price: number;
  oldPrice: number | null;

  images: string[];
  variants: ProductVariant[];

  /** Вес в граммах и габариты упаковки в см — без них СДЭК не считает доставку. */
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;

  isPublished: boolean;
  isBestseller: boolean;
  /** Отмечен для раздела «Распродажа» — вручную, галочкой в карточке. */
  isSale: boolean;

  /** Денормализация из отзывов, чтобы не считать при каждом рендере. */
  rating: { value: number; count: number } | null;

  seo: SeoFields;
  createdAt: string;
  /** Нужен для lastmod в sitemap — без него поисковик не видит обновлений. */
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEO
// ─────────────────────────────────────────────────────────────────────────────

/** Тип фасета посадочной страницы: третий сегмент адреса. */
export type LandingFacetType = "color" | "size" | "material";

/**
 * Посадочная страница фильтра: /catalog/{section}/{category}/{facet}.
 *
 * Каждая такая страница заводится вручную и несёт собственный текст.
 * Автогенерация всех сочетаний фильтров — прямой путь к тому, что Яндекс
 * пометит страницы как малополезные, а Google как дорвеи.
 */
export type SeoLanding = {
  id: string;
  sectionSlug: string;
  categorySlug: string;
  /** Третий сегмент адреса: `chernye`, `38-razmer`, `zamsha`. */
  facetSlug: string;
  facetType: LandingFacetType;
  /** Значение фильтра: слаг цвета, число размера либо код материала. */
  facetValue: string;
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  /** Уникальный текст. Меньше 400 знаков — страница не публикуется. */
  seoText: string;
  aliases: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Постоянный редирект: прежние адреса и синонимы. */
export type Redirect = {
  id: string;
  from: string;
  to: string;
  code: 301 | 410;
};

// ─────────────────────────────────────────────────────────────────────────────
// Отзывы и статьи
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Отзыв. Публикуется только после модерации и только настоящий:
 * разметка AggregateRating на выдуманных отзывах ловится и Яндексом,
 * и Google, и стоит ручных санкций.
 */
export type Review = {
  id: string;
  productId: string;
  userId: string | null;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  photos: string[];
  isApproved: boolean;
  createdAt: string;
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Тело статьи — ограниченный HTML из редактора админки. */
  body: string;
  cover: string | null;
  /** Блок вопрос-ответ внизу статьи, попадает в разметку FAQPage. */
  faq: { question: string; answer: string }[];
  isPublished: boolean;
  seo: SeoFields;
  publishedAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Пользователи
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "customer" | "admin";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  /** Когда почта подтверждена по ссылке из письма; null — ещё нет. */
  emailVerifiedAt: string | null;
  /** Хеш живой ссылки подтверждения и её срок. */
  verifyTokenHash: string | null;
  verifyTokenExpiresAt: string | null;
  /** Хеш живой ссылки восстановления пароля и её срок. */
  resetTokenHash: string | null;
  resetTokenExpiresAt: string | null;
};

/** Пользователь без секретов — то, что безопасно отдать в браузер. */
export type PublicUser = Omit<
  User,
  "passwordHash" | "verifyTokenHash" | "verifyTokenExpiresAt" | "resetTokenHash" | "resetTokenExpiresAt"
>;

// ─────────────────────────────────────────────────────────────────────────────
// Заказы
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "new"
  | "confirmed"
  | "shipped"
  | "completed"
  | "cancelled";

/**
 * Статус оплаты. У заказа — «не оплачен / ждёт / оплачен / возвращён»;
 * у отдельного платежа ЮKassa бывает ещё «отменён» — покупатель закрыл
 * страницу оплаты или банк отказал, и заказ ждёт новой попытки.
 */
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "canceled";

/**
 * Как покупатель платит: картой на сайте через ЮKassa или при получении —
 * наложенным платежом через СДЭК.
 */
export type PaymentMethod = "online" | "on_delivery";

/** Куда едет посылка: в пункт выдачи СДЭК или курьером до двери. */
export type DeliveryMode = "pvz" | "courier";

/**
 * Данные заказа на стороне СДЭК. `null` — если регистрация не удалась;
 * тогда заказ живёт только у нас, а менеджер передаёт его вручную.
 */
export type CdekShipment = {
  uuid: string;
  /** Трек-номер: его называют покупателю. */
  cdekNumber: string | null;
  statusCode: string;
  statusName: string;
  syncedAt: string;
};

export type OrderItem = {
  productId: string;
  variantId: string;
  /** Снимок данных на момент заказа — каталог может измениться позже. */
  title: string;
  slug: string;
  sizeEu: number;
  image: string | null;
  price: number;
  quantity: number;
};

export type OrderDelivery = {
  mode: DeliveryMode;
  cityCode: number;
  city: string;
  address: string;
  pointCode: string | null;
  periodMin: number | null;
  periodMax: number | null;
};

/** Город из справочника СДЭК — для подсказок в форме заказа. */
export type CdekCity = {
  code: number;
  city: string;
  region: string;
};

/** Пункт выдачи СДЭК. */
export type CdekDeliveryPoint = {
  code: string;
  name: string;
  address: string;
  addressFull: string;
  workTime: string;
  comment: string;
  hasDressingRoom: boolean;
  hasCashless: boolean;
  latitude: number | null;
  longitude: number | null;
};

/** Результат расчёта доставки: цена и срок в календарных днях. */
export type CdekQuote = {
  price: number;
  periodMin: number | null;
  periodMax: number | null;
};

export type Order = {
  id: string;
  /** Человекочитаемый номер заказа. */
  number: string;
  userId: string | null;
  customer: { name: string; email: string; phone: string };
  delivery: OrderDelivery;
  comment: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryPrice: number;
  packageWeight: number;
  total: number;
  promocode: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cdek: CdekShipment | null;
  createdAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Промокоды и платежи
// ─────────────────────────────────────────────────────────────────────────────

export type Promocode = {
  id: string;
  /** Всегда в верхнем регистре — сравнение нормализованное. */
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderTotal: number;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

/**
 * Платёж в ЮKassa. Хранится отдельно от заказа ради идемпотентности:
 * вебхук может прийти несколько раз, и повторная обработка не должна
 * ни задваивать статус, ни терять его.
 */
export type Payment = {
  id: string;
  /** Идентификатор платежа на стороне ЮKassa. */
  externalId: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  /** Ключ идемпотентности, с которым платёж был создан. */
  idempotenceKey: string;
  /** Адрес страницы оплаты, куда уходит покупатель. */
  confirmationUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Настройки
// ─────────────────────────────────────────────────────────────────────────────

/** Откуда отправляются посылки. Задаётся в админке, а не в переменных окружения. */
export type LogisticsSettings = {
  fromCityCode: number;
  fromCity: string;
  shipmentPointCode: string;
  shipmentPointAddress: string;
};

/** Идентификаторы счётчиков и коды подтверждения прав в поисковиках. */
export type SeoSettings = {
  yandexMetrikaId: string;
  googleAnalyticsId: string;
  yandexVerification: string;
  googleVerification: string;
  /** Шаблоны метатегов с подстановками {category} {color} {size} {count}. */
  templates: {
    category: { title: string; description: string };
    product: { title: string; description: string };
    landing: { title: string; description: string };
  };
};
