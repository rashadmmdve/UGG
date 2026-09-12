import { z } from "zod";

import { RESERVED_SLUGS, SECTIONS } from "@/lib/constants";
import { MIN_LANDING_TEXT_LENGTH } from "@/server/repositories/seo";

/**
 * Схемы валидации, общие для форм и серверных действий.
 *
 * Проверка на сервере обязательна: серверные действия доступны прямым
 * POST-запросом в обход интерфейса, поэтому на клиентскую валидацию
 * полагаться нельзя.
 */

// ─── Примитивы ───────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Укажите email")
  .email("Проверьте формат email");

export const passwordSchema = z
  .string()
  .min(8, "Минимум 8 символов")
  .max(128, "Слишком длинный пароль");

export const phoneSchema = z
  .string()
  .trim()
  .min(10, "Укажите телефон")
  .max(20, "Слишком длинный номер")
  .regex(/^[\d\s()+-]+$/, "Только цифры, пробелы и символы + ( ) -");

/**
 * Слаг — часть адреса страницы.
 *
 * Отдельно отсекаются служебные слова: категория со слагом `product` или
 * `catalog` перекрыла бы существующий маршрут, и поймать это потом было бы
 * тяжело — страница просто перестала бы открываться.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Укажите адрес страницы")
  .max(80, "Слишком длинный адрес")
  .regex(/^[a-z0-9-]+$/, "Только латиница в нижнем регистре, цифры и дефис")
  .refine((value) => !RESERVED_SLUGS.has(value), {
    message: "Этот адрес занят служебным разделом сайта",
  });

const sectionSlugSchema = z.enum(
  SECTIONS.map((section) => section.slug) as [string, ...string[]],
  { message: "Выберите раздел каталога" },
);

/** Переопределения метатегов — одинаковый набор у категорий, товаров и статей. */
export const seoFieldsSchema = z.object({
  metaTitle: z.string().trim().max(120).default(""),
  metaDescription: z.string().trim().max(320).default(""),
  h1: z.string().trim().max(160).default(""),
  seoText: z.string().trim().max(20000).default(""),
  noindex: z.boolean().default(false),
});

// ─── Аутентификация ──────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(60, "Слишком длинное имя"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(128),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Пароли не совпадают",
    path: ["confirm"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(60),
  phone: phoneSchema,
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Введите текущий пароль"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Пароли не совпадают",
    path: ["confirm"],
  })
  .refine((data) => data.password !== data.current, {
    message: "Новый пароль совпадает с текущим",
    path: ["password"],
  });

// ─── Оформление заказа ───────────────────────────────────────────────────────

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

export const checkoutSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя").max(60),
    email: emailSchema,
    phone: phoneSchema,
    deliveryMode: z.enum(["pvz", "courier"]),
    // Город выбирается из подсказок СДЭК, поэтому кроме названия приходит
    // и код — по нему считается доставка и ищутся пункты выдачи.
    cityCode: z.coerce.number().int().positive("Выберите город из списка"),
    city: z.string().trim().min(1, "Выберите город").max(80),
    address: z.string().trim().max(200).default(""),
    pointCode: z.string().trim().max(20).nullable().default(null),
    comment: z.string().trim().max(500).default(""),
    promocode: z.string().trim().max(40).default(""),
    paymentMethod: z.enum(["online", "on_delivery"], {
      message: "Выберите способ оплаты",
    }),
    items: z.array(cartItemSchema).min(1, "Корзина пуста"),
  })
  // Что именно обязательно, зависит от способа доставки: курьеру нужен
  // адрес, пункту выдачи — его код. Проверка здесь, чтобы ошибка попала
  // в нужное поле формы, а не в общий список.
  .refine((data) => data.deliveryMode !== "courier" || data.address.length > 0, {
    message: "Укажите адрес доставки",
    path: ["address"],
  })
  .refine((data) => data.deliveryMode !== "pvz" || Boolean(data.pointCode), {
    message: "Выберите пункт выдачи",
    path: ["pointCode"],
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ─── Каталог ─────────────────────────────────────────────────────────────────

export const productVariantSchema = z.object({
  id: z.string().min(1),
  // Европейский размер. Дробные существуют в детской сетке, поэтому не int.
  sizeEu: z.coerce
    .number()
    .min(15, "Слишком маленький размер")
    .max(50, "Слишком большой размер"),
  // Длина стельки в сантиметрах — главный ориентир покупателя при выборе.
  insoleCm: z.coerce.number().min(5).max(40).nullable().default(null),
  sizeUs: z.string().trim().max(10).nullable().default(null),
  stock: z.coerce.number().int().min(0).max(9999),
  barcode: z.string().trim().max(40).default(""),
  markingCode: z.string().trim().max(200).default(""),
});

export const productSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  title: z.string().trim().min(2, "Укажите название").max(160),
  sku: z.string().trim().max(40).default(""),
  description: z.string().trim().max(5000).default(""),

  gender: z.enum(["women", "men", "kids", "unisex"]),
  modelLineId: z.string().nullable().default(null),
  colorId: z.string().nullable().default(null),
  categoryIds: z.array(z.string()).min(1, "Выберите хотя бы одну категорию"),
  primaryCategoryId: z.string().min(1, "Выберите основную категорию"),
  // Связывает цветовые вариации одной модели — блок «другие цвета».
  groupId: z.string().trim().max(60).nullable().default(null),

  materials: z
    .array(z.enum(["ovchina", "zamsha", "kozha", "vyazanyj", "tekstil"]))
    .default([]),
  seasons: z.array(z.enum(["winter", "demi", "summer", "home"])).default([]),
  shaftHeightCm: z.coerce.number().min(0).max(60).nullable().default(null),
  heelHeightCm: z.coerce.number().min(0).max(20).nullable().default(null),

  price: z.coerce.number().int().min(0, "Цена не может быть отрицательной"),
  oldPrice: z.coerce.number().int().min(0).nullable(),
  costPrice: z.coerce.number().int().min(0).nullable(),

  images: z.array(z.string()).default([]),
  variants: z.array(productVariantSchema).min(1, "Добавьте хотя бы один размер"),

  // Вес в граммах и габариты в сантиметрах — по ним СДЭК считает доставку.
  // Верхние границы взяты из ограничений тарифа «Посылка» (до 50 кг).
  weight: z.coerce.number().int().min(1, "Укажите вес").max(50000),
  length: z.coerce.number().int().min(1).max(150),
  width: z.coerce.number().int().min(1).max(150),
  height: z.coerce.number().int().min(1).max(150),

  isPublished: z.boolean(),
  isBestseller: z.boolean(),
  isSale: z.boolean(),
  seo: seoFieldsSchema,
})
  // Основная категория задаёт хлебные крошки и родителя в канонической
  // ссылке, поэтому она обязана быть среди выбранных.
  .refine((data) => data.categoryIds.includes(data.primaryCategoryId), {
    message: "Основная категория должна быть среди выбранных",
    path: ["primaryCategoryId"],
  });

export const categorySchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  sectionSlug: sectionSlugSchema,
  title: z.string().trim().min(2, "Укажите название").max(120),
  shortTitle: z.string().trim().max(60).default(""),
  description: z.string().trim().max(2000).default(""),
  image: z.string().trim().max(300).nullable().default(null),
  order: z.coerce.number().int().min(0).max(999),
  isPublished: z.boolean(),
  // Синонимы и прежние адреса. Отдаются 301-редиректом, а не отдельной
  // страницей: две страницы под один запрос отбирают позиции друг у друга.
  aliases: z.array(z.string().trim().regex(/^[a-z0-9-]+$/)).default([]),
  seo: seoFieldsSchema,
});

export const modelLineSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  title: z.string().trim().min(2, "Укажите название").max(80),
  description: z.string().trim().max(2000).default(""),
  genders: z
    .array(z.enum(["women", "men", "kids", "unisex"]))
    .min(1, "Укажите, для кого выпускается линия"),
  sizeChartId: z.string().nullable().default(null),
  order: z.coerce.number().int().min(0).max(999),
});

export const colorSchema = z.object({
  id: z.string().min(1),
  // Слаг группы цвета — попадает в адрес посадочной страницы.
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Только латиница, цифры и дефис"),
  title: z.string().trim().min(1, "Укажите название оттенка").max(60),
  group: z.string().trim().min(1, "Укажите группу цвета").max(40),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #rrggbb"),
});

export const sizeChartSchema = z.object({
  id: z.string().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(80),
  gender: z.enum(["women", "men", "kids", "unisex"]),
  rows: z
    .array(
      z.object({
        sizeEu: z.coerce.number().min(15).max(50),
        sizeUs: z.string().trim().max(10).default(""),
        sizeUk: z.string().trim().max(10).default(""),
        insoleCm: z.coerce.number().min(5).max(40),
      }),
    )
    .min(1, "Добавьте хотя бы одну строку"),
});

// ─── SEO ─────────────────────────────────────────────────────────────────────

/**
 * Посадочная страница фильтра.
 *
 * Опубликовать её можно только с заполненными метатегами и собственным
 * текстом: страница-пустышка со списком товаров и подставленным заголовком —
 * это и есть дорвей, за который прилетает фильтр на весь сайт.
 * Наличие товаров проверяется отдельно, уже при рендере.
 */
export const seoLandingSchema = z
  .object({
    id: z.string().min(1),
    sectionSlug: sectionSlugSchema,
    categorySlug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
    facetSlug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
    facetType: z.enum(["color", "size", "material"]),
    facetValue: z.string().trim().min(1),
    title: z.string().trim().min(2).max(160),
    h1: z.string().trim().max(160).default(""),
    metaTitle: z.string().trim().max(120).default(""),
    metaDescription: z.string().trim().max(320).default(""),
    seoText: z.string().trim().max(20000).default(""),
    aliases: z.array(z.string().trim().regex(/^[a-z0-9-]+$/)).default([]),
    isPublished: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!data.isPublished) return;

    const required = [
      ["h1", data.h1, "Заполните заголовок H1"],
      ["metaTitle", data.metaTitle, "Заполните заголовок страницы"],
      ["metaDescription", data.metaDescription, "Заполните описание страницы"],
    ] as const;

    for (const [path, value, message] of required) {
      if (value.trim().length === 0) {
        ctx.addIssue({ code: "custom", message, path: [path] });
      }
    }

    if (data.seoText.trim().length < MIN_LANDING_TEXT_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `Нужен собственный текст от ${MIN_LANDING_TEXT_LENGTH} знаков — иначе страница будет расценена как малополезная`,
        path: ["seoText"],
      });
    }
  });

export const redirectSchema = z.object({
  id: z.string().min(1),
  from: z.string().trim().min(1, "Укажите адрес").startsWith("/", "Адрес должен начинаться с /"),
  to: z.string().trim().default(""),
  code: z.union([z.literal(301), z.literal(410)]),
});

// ─── Отзывы и статьи ─────────────────────────────────────────────────────────

export const reviewSchema = z.object({
  productId: z.string().min(1),
  authorName: z.string().trim().min(2, "Укажите имя").max(60),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10, "Напишите хотя бы пару предложений").max(3000),
  photos: z.array(z.string()).max(5).default([]),
});

export const articleSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  title: z.string().trim().min(4, "Укажите заголовок").max(200),
  excerpt: z.string().trim().max(500).default(""),
  body: z.string().trim().max(100000).default(""),
  cover: z.string().trim().max(300).nullable().default(null),
  // Блок вопрос-ответ попадает в разметку FAQPage и в быстрые ответы Яндекса.
  faq: z
    .array(
      z.object({
        question: z.string().trim().min(4).max(300),
        answer: z.string().trim().min(4).max(2000),
      }),
    )
    .default([]),
  isPublished: z.boolean(),
  publishedAt: z.string(),
  seo: seoFieldsSchema,
});

// ─── Прочее ──────────────────────────────────────────────────────────────────

export const promocodeSchema = z.object({
  id: z.string().min(1),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Минимум 3 символа")
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Только латиница, цифры и дефис"),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().min(1, "Укажите размер скидки"),
  minOrderTotal: z.coerce.number().int().min(0),
  expiresAt: z.string().nullable(),
  usageLimit: z.coerce.number().int().min(1).nullable(),
  isActive: z.boolean(),
})
  .refine((data) => data.type !== "percent" || data.value <= 100, {
    message: "Процент скидки не может быть больше 100",
    path: ["value"],
  });

export const logisticsSchema = z.object({
  fromCityCode: z.coerce.number().int().positive("Выберите город отправления"),
  fromCity: z.string().trim().min(1).max(80),
  shipmentPointCode: z.string().trim().max(20).default(""),
  shipmentPointAddress: z.string().trim().max(300).default(""),
});

export const orderStatusSchema = z.enum([
  "new",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
]);
