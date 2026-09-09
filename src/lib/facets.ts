import type { LandingFacetType } from "@/lib/types";

/**
 * Адрес фасета в посадочной странице — третий сегмент пути.
 *
 * Общий для сервера и браузера: форма посадочной подставляет его при
 * вводе, подсказчик кандидатов в админке — при создании черновика.
 * Расхождение дало бы две страницы под один фильтр.
 */
export function facetSlugFor(type: LandingFacetType, value: string): string {
  const clean = value.trim().toLowerCase();
  switch (type) {
    case "size":
      return `${clean}-razmer`;
    case "color":
    case "material":
      return clean;
  }
}

export const FACET_TYPE_LABELS: Record<LandingFacetType, string> = {
  color: "Цвет",
  size: "Размер",
  material: "Материал",
};
