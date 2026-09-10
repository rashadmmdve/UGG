import "server-only";

import type { Metadata } from "next";

import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getSeoSettings } from "@/server/repositories/seo";
import type { Product, SeoFields } from "@/lib/types";

/**
 * Сборка метатегов.
 *
 * Работает по одному правилу: если у сущности заполнено собственное поле —
 * берётся оно, иначе применяется шаблон из настроек. Так у восьмидесяти
 * посадочных страниц не приходится заполнять заголовки руками, но у любой
 * из них его можно переопределить.
 */

type Tokens = {
  category?: string;
  facet?: string;
  title?: string;
  count?: number;
  minPrice?: number;
  price?: number;
};

/**
 * Подстановка значений в шаблон: {category}, {count}, {minPrice} и т.д.
 *
 * Если цены нет (в подборке нет товаров), фрагмент «от {minPrice} ₽»
 * вырезается целиком, а не подставляется пустотой: иначе в описание
 * попадает обрывок «от ₽», и он уходит прямо в выдачу.
 */
function fill(template: string, tokens: Tokens): string {
  if (tokens.minPrice === undefined) {
    template = template.replace(/,?\s*от \{minPrice\}\s*₽/g, "");
  }
  if (tokens.price === undefined) {
    template = template.replace(/\s*за \{price\}\s*₽/g, "");
  }

  return template
    .replace(/\{site\}/g, SITE_NAME)
    .replace(/\{category\}/g, tokens.category ?? "")
    .replace(/\{facet\}/g, tokens.facet ?? "")
    .replace(/\{title\}/g, tokens.title ?? "")
    .replace(/\{count\}/g, String(tokens.count ?? 0))
    .replace(
      /\{minPrice\}/g,
      tokens.minPrice ? tokens.minPrice.toLocaleString("ru-RU") : "",
    )
    .replace(
      /\{price\}/g,
      tokens.price ? tokens.price.toLocaleString("ru-RU") : "",
    )
    // Пустая подстановка оставляет двойные пробелы — подчищаем.
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Наименьшая цена в подборке — для подстановки «от N ₽». */
export function minPrice(products: Product[]): number | undefined {
  if (products.length === 0) return undefined;
  return products.reduce(
    (min, product) => (product.price < min ? product.price : min),
    products[0].price,
  );
}

export type MetaInput = {
  /** Канонический путь от корня, например /catalog/zhenskie/classic-mini. */
  path: string;
  /** Собственные поля сущности — имеют приоритет над шаблоном. */
  seo?: SeoFields;
  /** Какой шаблон применять, если своих полей нет. */
  template: "category" | "product" | "landing";
  tokens: Tokens;
  images?: string[];
  /**
   * Закрыть страницу от индексации. Ставится, когда условия публикации
   * не выполнены — например, у посадочной кончились товары.
   */
  noindex?: boolean;
};

/**
 * Описание для страницы, где нет ни одного товара.
 *
 * Шаблон здесь не годится: он построен вокруг количества и цены, а
 * фраза «0 моделей в наличии» — ровно тот текст, который не должен
 * попасть в выдачу. Такие страницы всё равно закрываются от индексации,
 * но описание должно быть осмысленным и для человека по прямой ссылке.
 */
function emptyDescription(categoryTitle: string | undefined): string {
  const subject = categoryTitle ? `${categoryTitle} — ` : "";
  return (
    `${subject}раздел каталога обуви UGG®. ` +
    "Сейчас товары этой категории закончились, скоро поступят новые."
  );
}

export function buildMetadata(input: MetaInput): Metadata {
  const settings = getSeoSettings();
  const templates = settings.templates[input.template];
  const isEmpty = input.tokens.count === 0;

  const title =
    input.seo?.metaTitle?.trim() || fill(templates.title, input.tokens);
  const description =
    input.seo?.metaDescription?.trim() ||
    (isEmpty
      ? emptyDescription(input.tokens.category)
      : fill(templates.description, input.tokens));

  // Страница без товаров в индексе бесполезна: и для покупателя, и для
  // поисковика это пустая витрина. Ссылки с неё при этом остаются живыми.
  const noindex = input.noindex || isEmpty || input.seo?.noindex === true;

  return {
    // Шаблон заголовка из корневого макета добавил бы название магазина
    // второй раз — в наших шаблонах оно уже есть, поэтому absolute.
    title: { absolute: title },
    description,
    alternates: {
      /**
       * Канонический адрес всегда указывает сам на себя и никогда не
       * содержит параметров фильтра: тело ответа при клиентской
       * фильтрации совпадает с чистым адресом.
       */
      canonical: input.path,
    },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: SITE_NAME,
      title,
      description,
      url: `${SITE_URL}${input.path}`,
      images: input.images?.length ? input.images : undefined,
    },
    robots: noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}
