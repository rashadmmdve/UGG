import "server-only";

import { getColorById, getColors } from "@/server/repositories/catalog";
import type { LandingFacetType, Material, Product } from "@/lib/types";

/**
 * Фасеты каталога — цвет, размер, материал.
 *
 * Один и тот же код обслуживает и фильтры в каталоге, и посадочные
 * страницы фильтров. Держать две реализации нельзя: тогда страница
 * `/catalog/zhenskie/classic-mini/chernye` и фильтр «чёрные» в том же
 * каталоге показывали бы разные наборы товаров.
 */

export const MATERIAL_TITLES: Record<Material, string> = {
  ovchina: "овчина",
  zamsha: "замша",
  kozha: "кожа",
  vyazanyj: "вязаные",
  tekstil: "текстиль",
};

/** Есть ли товар в наличии хотя бы в одном размере. */
export function inStock(product: Product): boolean {
  return product.variants.some((variant) => variant.stock > 0);
}

/**
 * Сколько товаров подборки реально можно купить.
 *
 * Именно это число проверяется порогом публикации посадочной страницы.
 * Отбор по цвету или материалу распроданные позиции не отсеивает — они
 * остаются на странице, чтобы покупатель видел модельный ряд, — но
 * страница, где купить нечего, в индексе не нужна.
 */
export function availableCount(products: Product[]): number {
  return products.filter(inStock).length;
}

/**
 * Отбор товаров по значению фасета.
 *
 * Для размера учитывается именно наличие: страница «UGG Classic Mini
 * 38 размер» без единой доступной пары — это обещание, которого магазин
 * не выполняет, и поисковик такие страницы отслеживает по отказам.
 */
export function filterByFacet(
  products: Product[],
  type: LandingFacetType,
  value: string,
): Product[] {
  switch (type) {
    case "color": {
      return products.filter((product) => {
        if (!product.colorId) return false;
        return getColorById(product.colorId)?.slug === value;
      });
    }
    case "size": {
      const size = Number(value);
      if (Number.isNaN(size)) return [];
      return products.filter((product) =>
        product.variants.some(
          (variant) => variant.sizeEu === size && variant.stock > 0,
        ),
      );
    }
    case "material": {
      return products.filter((product) =>
        product.materials.includes(value as Material),
      );
    }
  }
}

/** Человекочитаемое название фасета для заголовков и метатегов. */
export function facetTitle(type: LandingFacetType, value: string): string {
  switch (type) {
    case "color": {
      const color = getColors().find((item) => item.slug === value);
      return color ? color.group.toLowerCase() : value;
    }
    case "size":
      return `${value} размер`;
    case "material":
      return MATERIAL_TITLES[value as Material] ?? value;
  }
}

export type FacetOption = {
  type: LandingFacetType;
  value: string;
  title: string;
  count: number;
};

/**
 * Доступные значения фасетов в подборке — для сайдбара фильтров и для
 * подсказчика посадочных страниц в админке.
 *
 * Считается по товарам в наличии: фильтр, ведущий в пустой список,
 * раздражает покупателя и тратит краулинговый бюджет.
 */
export function collectFacets(products: Product[]): {
  colors: FacetOption[];
  sizes: FacetOption[];
  materials: FacetOption[];
} {
  const available = products.filter(inStock);

  const colorCounts = new Map<string, number>();
  const sizeCounts = new Map<number, number>();
  const materialCounts = new Map<string, number>();

  for (const product of available) {
    if (product.colorId) {
      const color = getColorById(product.colorId);
      if (color) {
        colorCounts.set(color.slug, (colorCounts.get(color.slug) ?? 0) + 1);
      }
    }

    // Размер считается один раз на товар, даже если пар несколько.
    const sizes = new Set(
      product.variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => variant.sizeEu)
        .filter((size) => size > 0),
    );
    for (const size of sizes) {
      sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
    }

    for (const material of product.materials) {
      materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
    }
  }

  const colors: FacetOption[] = [...colorCounts.entries()]
    .map(([value, count]) => ({
      type: "color" as const,
      value,
      title: facetTitle("color", value),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const sizes: FacetOption[] = [...sizeCounts.entries()]
    .map(([value, count]) => ({
      type: "size" as const,
      value: String(value),
      title: String(value),
      count,
    }))
    .sort((a, b) => Number(a.value) - Number(b.value));

  const materials: FacetOption[] = [...materialCounts.entries()]
    .map(([value, count]) => ({
      type: "material" as const,
      value,
      title: facetTitle("material", value),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return { colors, sizes, materials };
}
