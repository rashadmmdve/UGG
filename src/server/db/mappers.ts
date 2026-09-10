import "server-only";

import type {
  Article,
  Category,
  Color,
  Gender,
  Material,
  ModelLine,
  Order,
  Payment,
  Product,
  ProductVariant,
  Promocode,
  Redirect,
  Review,
  Season,
  SeoFields,
  SeoLanding,
  SizeChart,
  User,
} from "@/lib/types";

/**
 * Преобразование строк SQLite в доменные типы.
 *
 * SQLite не знает ни массивов, ни булевых значений: списки лежат в JSON-полях,
 * флаги — целыми числами. Все эти преобразования собраны здесь, чтобы
 * репозитории занимались запросами, а не разбором формата хранения.
 */

/** Разбор JSON-поля с запасным значением: битая строка не должна ронять страницу. */
function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const bool = (value: unknown): boolean => value === 1 || value === true;

export const toInt = (value: boolean): number => (value ? 1 : 0);

export const nowIso = (): string => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────

export type CategoryRow = {
  id: string;
  slug: string;
  section_slug: string;
  title: string;
  short_title: string | null;
  description: string;
  image: string | null;
  sort_order: number;
  is_published: number;
  aliases: string;
  seo: string;
  created_at: string;
  updated_at: string;
};

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    sectionSlug: row.section_slug,
    title: row.title,
    shortTitle: row.short_title ?? undefined,
    description: row.description,
    image: row.image,
    order: row.sort_order,
    isPublished: bool(row.is_published),
    aliases: parseJson<string[]>(row.aliases, []),
    seo: parseJson<SeoFields>(row.seo, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type ModelLineRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  genders: string;
  size_chart_id: string | null;
  sort_order: number;
};

export function mapModelLine(row: ModelLineRow): ModelLine {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    genders: parseJson<Gender[]>(row.genders, []),
    sizeChartId: row.size_chart_id,
    order: row.sort_order,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type ColorRow = {
  id: string;
  slug: string;
  title: string;
  group: string;
  hex: string;
};

export function mapColor(row: ColorRow): Color {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    group: row.group,
    hex: row.hex,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type SizeChartRow_ = {
  id: string;
  slug: string;
  title: string;
  gender: string;
  rows: string;
};

export function mapSizeChart(row: SizeChartRow_): SizeChart {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    gender: row.gender as Gender,
    rows: parseJson<SizeChart["rows"]>(row.rows, []),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  sku: string | null;
  description: string;
  gender: string;
  model_line_id: string | null;
  color_id: string | null;
  primary_category_id: string | null;
  group_id: string | null;
  materials: string;
  seasons: string;
  shaft_height_cm: number | null;
  heel_height_cm: number | null;
  price: number;
  old_price: number | null;
  images: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  is_published: number;
  is_bestseller: number;
  rating_value: number | null;
  rating_count: number;
  seo: string;
  created_at: string;
  updated_at: string;
};

export type VariantRow = {
  id: string;
  product_id: string;
  size_eu: number;
  insole_cm: number | null;
  stock: number;
  barcode: string | null;
  marking_code: string | null;
};

export function mapVariant(row: VariantRow): ProductVariant {
  return {
    id: row.id,
    sizeEu: row.size_eu,
    insoleCm: row.insole_cm,
    stock: row.stock,
    barcode: row.barcode ?? undefined,
    markingCode: row.marking_code ?? undefined,
  };
}

/**
 * Товар собирается из трёх источников: своя строка, варианты размеров и
 * список категорий. Репозиторий подтягивает их одним запросом на пачку
 * товаров, а не по одному на каждый, — иначе на странице каталога
 * получилось бы несколько сотен обращений к базе.
 */
export function mapProduct(
  row: ProductRow,
  variants: VariantRow[],
  categoryIds: string[],
): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sku: row.sku,
    description: row.description,
    gender: row.gender as Gender,
    modelLineId: row.model_line_id,
    colorId: row.color_id,
    categoryIds,
    primaryCategoryId: row.primary_category_id,
    groupId: row.group_id,
    materials: parseJson<Material[]>(row.materials, []),
    seasons: parseJson<Season[]>(row.seasons, []),
    shaftHeightCm: row.shaft_height_cm,
    heelHeightCm: row.heel_height_cm,
    price: row.price,
    oldPrice: row.old_price,
    images: parseJson<string[]>(row.images, []),
    variants: variants
      .map(mapVariant)
      .sort((a, b) => a.sizeEu - b.sizeEu),
    weight: row.weight,
    length: row.length,
    width: row.width,
    height: row.height,
    isPublished: bool(row.is_published),
    isBestseller: bool(row.is_bestseller),
    rating:
      row.rating_value !== null && row.rating_count > 0
        ? { value: row.rating_value, count: row.rating_count }
        : null,
    seo: parseJson<SeoFields>(row.seo, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type SeoLandingRow = {
  id: string;
  section_slug: string;
  category_slug: string;
  facet_slug: string;
  facet_type: string;
  facet_value: string;
  title: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  seo_text: string;
  aliases: string;
  is_published: number;
  created_at: string;
  updated_at: string;
};

export function mapSeoLanding(row: SeoLandingRow): SeoLanding {
  return {
    id: row.id,
    sectionSlug: row.section_slug,
    categorySlug: row.category_slug,
    facetSlug: row.facet_slug,
    facetType: row.facet_type as SeoLanding["facetType"],
    facetValue: row.facet_value,
    title: row.title,
    h1: row.h1,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    seoText: row.seo_text,
    aliases: parseJson<string[]>(row.aliases, []),
    isPublished: bool(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type RedirectRow = { id: string; from: string; to: string; code: number };

export function mapRedirect(row: RedirectRow): Redirect {
  return {
    id: row.id,
    from: row.from,
    to: row.to,
    code: row.code === 410 ? 410 : 301,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string | null;
  author_name: string;
  rating: number;
  text: string;
  photos: string;
  is_approved: number;
  created_at: string;
};

export function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating as Review["rating"],
    text: row.text,
    photos: parseJson<string[]>(row.photos, []),
    isApproved: bool(row.is_approved),
    createdAt: row.created_at,
  };
}

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover: string | null;
  faq: string;
  is_published: number;
  seo: string;
  published_at: string;
  updated_at: string;
};

export function mapArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    cover: row.cover,
    faq: parseJson<Article["faq"]>(row.faq, []),
    isPublished: bool(row.is_published),
    seo: parseJson<SeoFields>(row.seo, {}),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string;
  role: string;
  created_at: string;
  email_verified_at: string | null;
  verify_token_hash: string | null;
  verify_token_expires_at: string | null;
  reset_token_hash: string | null;
  reset_token_expires_at: string | null;
};

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    phone: row.phone,
    role: row.role === "admin" ? "admin" : "customer",
    createdAt: row.created_at,
    emailVerifiedAt: row.email_verified_at ?? null,
    verifyTokenHash: row.verify_token_hash ?? null,
    verifyTokenExpiresAt: row.verify_token_expires_at ?? null,
    resetTokenHash: row.reset_token_hash ?? null,
    resetTokenExpiresAt: row.reset_token_expires_at ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type OrderRow = {
  id: string;
  number: string;
  user_id: string | null;
  customer: string;
  delivery: string;
  comment: string;
  items: string;
  subtotal: number;
  discount: number;
  delivery_price: number;
  package_weight: number;
  total: number;
  promocode: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  cdek: string | null;
  created_at: string;
  updated_at: string;
};

export function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    userId: row.user_id,
    customer: parseJson<Order["customer"]>(row.customer, {
      name: "",
      email: "",
      phone: "",
    }),
    delivery: parseJson<Order["delivery"]>(row.delivery, {
      mode: "pvz",
      cityCode: 0,
      city: "",
      address: "",
      pointCode: null,
      periodMin: null,
      periodMax: null,
    }),
    comment: row.comment,
    items: parseJson<Order["items"]>(row.items, []),
    subtotal: row.subtotal,
    discount: row.discount,
    deliveryPrice: row.delivery_price,
    packageWeight: row.package_weight,
    total: row.total,
    promocode: row.promocode,
    status: row.status as Order["status"],
    paymentMethod: row.payment_method as Order["paymentMethod"],
    paymentStatus: row.payment_status as Order["paymentStatus"],
    cdek: row.cdek ? parseJson<Order["cdek"]>(row.cdek, null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PromocodeRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_order_total: number;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: number;
};

export function mapPromocode(row: PromocodeRow): Promocode {
  return {
    id: row.id,
    code: row.code,
    type: row.type === "fixed" ? "fixed" : "percent",
    value: row.value,
    minOrderTotal: row.min_order_total,
    expiresAt: row.expires_at,
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    isActive: bool(row.is_active),
  };
}

export type PaymentRow = {
  id: string;
  external_id: string;
  order_id: string;
  amount: number;
  status: string;
  idempotence_key: string;
  confirmation_url: string | null;
  created_at: string;
  updated_at: string;
};

export function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    externalId: row.external_id,
    orderId: row.order_id,
    amount: row.amount,
    status: row.status as Payment["status"],
    idempotenceKey: row.idempotence_key,
    confirmationUrl: row.confirmation_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
