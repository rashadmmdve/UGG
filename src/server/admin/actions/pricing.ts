"use server";

import { assertAdmin } from "@/server/admin/guard";
import { parsePricingCsv } from "@/server/admin/pricing-csv";
import { basePrice, salePrice } from "@/lib/pricing";
import { applyPricing, getPricingRows, type PricingPatch } from "@/server/repositories/pricing";
import { revalidateCatalog } from "@/server/seo/revalidate";
import { DENIED, jsonField, type ActionState } from "@/server/validation/errors";

/**
 * Блок «Цены»: правка в таблице и загрузка из файла.
 *
 * Оба пути сходятся в toStored(): владелец задаёт «цену» и, если нужно,
 * «цену со скидкой»; в базе это превращается в продажную цену и цену до
 * скидки. Нет скидочной — действует обычная. Скидочная должна быть ниже
 * обычной, иначе значок скидки показал бы минус.
 */

function parseMoney(raw: FormDataEntryValue | null): number | null | "bad" {
  const text = String(raw ?? "").replace(/[\s  ₽]/g, "").replace(",", ".");
  if (text === "") return null;
  const value = Number(raw === null ? NaN : text);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : "bad";
}

type Check = { ok: true; patch: PricingPatch } | { ok: false; error: string };

function toStored(input: {
  id: string;
  title: string;
  base: number | null;
  sale: number | null;
  costPrice: number | null;
  isSale: boolean;
  isBestseller: boolean;
}): Check {
  if (input.base === null) return { ok: false, error: `${input.title}: цена пустая.` };
  if (input.sale !== null && input.sale >= input.base) {
    return { ok: false, error: `${input.title}: цена со скидкой должна быть ниже цены.` };
  }
  return {
    ok: true,
    patch: {
      id: input.id,
      price: input.sale ?? input.base,
      oldPrice: input.sale === null ? null : input.base,
      costPrice: input.costPrice,
      isSale: input.isSale,
      isBestseller: input.isBestseller,
    },
  };
}

/**
 * Сохранить таблицу. Поля: base_<id>, sale_<id>, cost_<id>, insale_<id>,
 * hit_<id>; ids — список строк, которые были на экране.
 */
export async function savePricingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const ids = jsonField<string[]>(formData, "ids", []);
  const titles = new Map(getPricingRows().map((row) => [row.id, row.title]));
  const patches: PricingPatch[] = [];
  const errors: string[] = [];

  for (const id of ids) {
    const title = titles.get(id);
    if (!title) continue;

    const base = parseMoney(formData.get(`base_${id}`));
    const sale = parseMoney(formData.get(`sale_${id}`));
    const costPrice = parseMoney(formData.get(`cost_${id}`));
    if (base === "bad" || sale === "bad" || costPrice === "bad") {
      errors.push(`${title}: цена должна быть числом.`);
      continue;
    }

    const result = toStored({
      id,
      title,
      base,
      sale,
      costPrice,
      isSale: formData.get(`insale_${id}`) === "on",
      isBestseller: formData.get(`hit_${id}`) === "on",
    });
    if (result.ok) patches.push(result.patch);
    else errors.push(result.error);
  }

  if (errors.length) {
    return {
      error: `Не сохранено. ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` …и ещё ${errors.length - 5}.` : ""}`,
    };
  }

  const changed = applyPricing(patches);
  if (changed) revalidateCatalog();
  return { success: changed ? `Изменено товаров: ${changed}.` : "Изменений нет." };
}

/** Загрузить CSV. Товар ищется по ID, затем по артикулу. */
export async function importPricingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл CSV." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Файл больше 5 МБ — это не похоже на таблицу цен." };
  }

  const parsed = parsePricingCsv(await file.text());
  if (parsed.errors.length && parsed.rows.length === 0) {
    return { error: parsed.errors.slice(0, 5).join(" ") };
  }

  const rows = getPricingRows();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const bySku = new Map(rows.filter((row) => row.sku).map((row) => [row.sku!.toLowerCase(), row]));

  const patches: PricingPatch[] = [];
  const errors = [...parsed.errors];
  let notFound = 0;

  for (const item of parsed.rows) {
    const current =
      (item.id && byId.get(item.id)) || (item.sku && bySku.get(item.sku.toLowerCase())) || null;
    if (!current) {
      notFound++;
      continue;
    }

    // Столбца в файле нет — значение остаётся прежним. Пустая ячейка в
    // существующем столбце — «очистить»: так убирают скидку.
    const result = toStored({
      id: current.id,
      title: current.title,
      base: item.price ?? basePrice(current),
      sale: item.salePrice === undefined ? salePrice(current) : item.salePrice,
      costPrice: item.costPrice === undefined ? current.costPrice : item.costPrice,
      isSale: item.isSale === undefined ? current.isSale : item.isSale,
      isBestseller: item.isBestseller === undefined ? current.isBestseller : item.isBestseller,
    });
    if (result.ok) patches.push(result.patch);
    else errors.push(`Строка ${item.line}: ${result.error}`);
  }

  if (errors.length) {
    return {
      error: `Файл не применён — сначала исправьте ошибки. ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` …и ещё ${errors.length - 5}.` : ""}`,
    };
  }

  const changed = applyPricing(patches);
  if (changed) revalidateCatalog();

  const parts = [`Изменено товаров: ${changed}`];
  if (patches.length - changed) parts.push(`без изменений: ${patches.length - changed}`);
  if (notFound) parts.push(`не найдено по ID и артикулу: ${notFound}`);
  return { success: `${parts.join(", ")}.` };
}
