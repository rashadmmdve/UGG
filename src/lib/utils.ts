import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Склейка классов Tailwind с разрешением конфликтов. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Таблица транслитерации для слагов. */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "yu", я: "ya",
};

/**
 * Слаг для адреса страницы: только строчные латинские буквы, цифры и дефис.
 *
 * Слаг — часть URL, а адрес после индексации менять дорого: переименование
 * проиндексированной категории стоит месяцев восстановления позиций.
 * Поэтому результат намеренно предсказуемый и не зависит от локали.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Цена в рублях: «12 990 ₽». */
export function formatPrice(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

/** Дата для покупателя: «9 сентября 2026». */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Склонение существительного после числа: 1 товар, 2 товара, 5 товаров. */
export function plural(
  count: number,
  forms: [one: string, few: string, many: string],
): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Абсолютный адрес для канонических ссылок и разметки. */
export function absoluteUrl(base: string, path: string): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
