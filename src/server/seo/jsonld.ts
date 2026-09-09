import "server-only";

import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getColorById, getModelLineById } from "@/server/repositories/catalog";
import { getContent } from "@/server/repositories/settings";
import type { Crumb } from "@/server/seo/breadcrumbs";
import type { Product, Review } from "@/lib/types";

/**
 * Сборка разметки schema.org.
 *
 * Готовых средств в Next для этого нет — блок выводится обычным тегом
 * script с типом application/ld+json.
 *
 * Отдельно стоит помнить: для российской выдачи YML-фид в Яндекс Вебмастере
 * весит больше, чем эта разметка. Из перечисленного ниже Яндекс активно
 * использует BreadcrumbList, Organization и FAQPage.
 */

type Json = Record<string, unknown>;

/** Абсолютный адрес: относительные пути в разметке не принимаются. */
const abs = (path: string): string =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export function organizationLd(): Json {
  const contacts = getContent().contacts;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    // По этому полю Яндекс и Google берут знак для карточки организации.
    logo: `${SITE_URL}/brand/ugg-logo.png`,
    image: `${SITE_URL}/brand/ugg-logo.png`,
    ...(contacts.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: contacts.phone,
            contactType: "customer service",
            areaServed: "RU",
            availableLanguage: "Russian",
          },
        }
      : {}),
    ...(contacts.email ? { email: contacts.email } : {}),
  };
}

export function webSiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "ru-RU",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Хлебные крошки.
 *
 * Строятся из того же массива, что и видимая навигация: если считать их
 * отдельно, разметка и страница рано или поздно разойдутся.
 */
export function breadcrumbLd(crumbs: Crumb[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.title,
      // У последнего элемента ссылки нет — это текущая страница.
      ...(crumb.url ? { item: crumb.url } : {}),
    })),
  };
}

/** Список товаров в подборке. Полные карточки внутрь не вкладываем. */
export function itemListLd(products: Product[], limit = 24): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: products.length,
    itemListElement: products.slice(0, limit).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: abs(`/product/${product.slug}`),
      name: product.title,
      ...(product.images[0] ? { image: abs(product.images[0]) } : {}),
    })),
  };
}

/**
 * Карточка товара.
 *
 * Когда размеры различаются по наличию, отдаётся AggregateOffer с
 * диапазоном: единый Offer в такой ситуации утверждал бы, что доступны
 * все размеры, а это расхождение разметки с содержимым страницы.
 *
 * AggregateRating выводится только при наличии настоящих отзывов.
 * Разметка рейтинга на выдуманных данных ловится и Яндексом, и Google,
 * и стоит ручных санкций.
 */
export function productLd(product: Product, reviews: Review[]): Json {
  const url = abs(`/product/${product.slug}`);
  const color = product.colorId ? getColorById(product.colorId) : null;
  const modelLine = product.modelLineId
    ? getModelLineById(product.modelLineId)
    : null;

  const inStockCount = product.variants.filter((v) => v.stock > 0).length;
  const availability =
    inStockCount > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  // Цену обещаем на год вперёд — Google требует это поле у предложений.
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const offerBase = {
    priceCurrency: "RUB",
    availability,
    itemCondition: "https://schema.org/NewCondition",
    url,
    seller: { "@id": `${SITE_URL}/#organization` },
    priceValidUntil,
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "RU",
      returnPolicyCategory:
        "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 14,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFeesCategory: "https://schema.org/FreeReturn",
    },
  };

  const offers =
    inStockCount > 1
      ? {
          "@type": "AggregateOffer",
          offerCount: inStockCount,
          lowPrice: product.price,
          highPrice: product.price,
          ...offerBase,
        }
      : { "@type": "Offer", price: product.price, ...offerBase };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    url,
    image: product.images.map(abs),
    brand: { "@type": "Brand", name: "UGG" },
    ...(product.sku ? { sku: product.sku } : {}),
    ...(color ? { color: color.title } : {}),
    ...(modelLine ? { model: modelLine.title } : {}),
    ...(product.materials.length ? { material: product.materials.join(", ") } : {}),
    offers,
    ...(product.rating && product.rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.value,
            reviewCount: product.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            author: { "@type": "Person", name: review.authorName },
            datePublished: review.createdAt.slice(0, 10),
            reviewRating: {
              "@type": "Rating",
              ratingValue: review.rating,
              bestRating: 5,
              worstRating: 1,
            },
            reviewBody: review.text,
          })),
        }
      : {}),
  };
}

/** Блок вопрос-ответ. Выводится только там, где он реально есть на странице. */
export function faqLd(items: { question: string; answer: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
