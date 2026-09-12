"use server";

import {
  FALLBACK_WEIGHT,
  getDeliveryPoints,
  quoteDelivery,
  searchCities,
} from "@/server/cdek/api";
import { isSelfDelivery } from "@/lib/delivery";
import { assertAdmin } from "@/server/admin/guard";
import { getProductById } from "@/server/repositories/catalog";
import type { CdekCity, CdekDeliveryPoint, CdekQuote } from "@/lib/types";

/**
 * Действия формы заказа, которым нужны данные СДЭК.
 *
 * Вес и габариты считаются здесь по каталогу, а не берутся с клиента:
 * подменив их, покупатель занизил бы себе стоимость доставки.
 */

export type CartLine = { productId: string; quantity: number };

/**
 * Суммарный вес заказа и габариты посылки.
 *
 * Обувь едет в коробках, и коробки ставятся друг на друга: длина и ширина
 * остаются наибольшими из товаров, а высота складывается. Если брать
 * максимум по всем трём сторонам, объёмный вес выйдет заниженным, и
 * покупателю покажут цену доставки меньше той, что выставит СДЭК.
 */
async function measureCart(items: CartLine[]) {
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;

  for (const line of items) {
    const product = getProductById(line.productId);
    if (!product) continue;

    weight += (product.weight ?? FALLBACK_WEIGHT) * line.quantity;
    length = Math.max(length, product.length ?? 0);
    width = Math.max(width, product.width ?? 0);
    height += (product.height ?? 0) * line.quantity;
  }

  const dimensions =
    length && width && height ? { length, width, height } : undefined;

  return { weight: Math.max(weight, 1), dimensions };
}

export async function searchCitiesAction(query: string): Promise<CdekCity[]> {
  try {
    return await searchCities(query);
  } catch {
    // Справочник недоступен — форма покажет подсказку, что город можно
    // ввести вручную, а не сломается целиком.
    return [];
  }
}

export async function getDeliveryPointsAction(
  cityCode: number,
  items: CartLine[],
): Promise<CdekDeliveryPoint[]> {
  try {
    const { weight } = await measureCart(items);
    return await getDeliveryPoints(cityCode, weight);
  } catch {
    return [];
  }
}

/**
 * Пункты приёма для админки — те, куда мы сами привозим посылки.
 * Список отличается от пунктов выдачи: не каждый ПВЗ принимает отправления.
 */
export async function getReceptionPointsAction(
  cityCode: number,
): Promise<CdekDeliveryPoint[]> {
  if (!(await assertAdmin())) return [];

  try {
    return await getDeliveryPoints(cityCode, undefined, "reception");
  } catch {
    return [];
  }
}

export type QuoteResult =
  | { ok: true; quote: CdekQuote }
  | { ok: false; error: string };

export async function quoteDeliveryAction(input: {
  cityCode: number;
  mode: "pvz" | "courier";
  pointCode?: string | null;
  items: CartLine[];
}): Promise<QuoteResult> {
  // Свой город возим сами и денег за это не берём: у СДЭК тут ничего не
  // спрашиваем — ни тарифа, ни сроков, их назовёт человек при звонке.
  if (isSelfDelivery({ cityCode: input.cityCode })) {
    return { ok: true, quote: { price: 0, periodMin: null, periodMax: null } };
  }

  try {
    const { weight, dimensions } = await measureCart(input.items);

    const quote = await quoteDelivery({
      cityCode: input.cityCode,
      mode: input.mode,
      deliveryPoint: input.pointCode ?? undefined,
      weightGrams: weight,
      dimensions,
    });

    if (!quote) {
      return {
        ok: false,
        error:
          "СДЭК не может доставить заказ по этому адресу. Выберите другой пункт или город.",
      };
    }

    return { ok: true, quote };
  } catch {
    return {
      ok: false,
      error: "Не удалось рассчитать доставку. Попробуйте ещё раз.",
    };
  }
}
