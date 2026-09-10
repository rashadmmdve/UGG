"use server";

import { assertAdmin } from "@/server/admin/guard";
import { parsePricingCsv } from "@/server/admin/pricing-csv";
import {
  applyPricing,
  getPricingRows,
  type PricingPatch,
} from "@/server/repositories/pricing";
import { revalidateCatalog } from "@/server/seo/revalidate";
import { DENIED, jsonField, type ActionState } from "@/server/validation/errors";

/**
 * Блок «Цены»: правка в таблице и загрузка из файла.
 *
 * Оба пути сходятся в applyPricing и одинаково проверяются: цена — целое
 * число не меньше нуля, старая цена либо пуста, либо выше цены (иначе
 * значок скидки покажет минус), себестоимость либо пуста, либо число.
 */

function parseMoney(raw: FormDataEntryValue | null): number | null | "bad" {
  const text = String(raw ?? "").replace(/[\s ₽]/g, "").replace(",", ".");
  if (text === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : "bad";
}

type Check = { ok: true; patch: PricingPatch } | { ok: false; error: string };

function check(input: {
  id: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  costPrice: number | null;
  isSale: boolean;
}): Check {
  if (input.price === null) return { ok: false, error: `${input.title}: цена пустая.` };
  if (input.oldPrice !== null && input.oldPrice <= input.price) {
    return { ok: false, error: `${input.title}: старая цена должна быть выше цены.` };
  }
  return {
    ok: true,
    patch: {
      id: input.id,
      price: input.price,
      oldPrice: input.oldPrice,
      costPrice: input.costPrice,
      isSale: input.isSale,
    },
  };
}

/** Сохранить таблицу. Поля: price_<id>, old_<id>, cost_<id>, sale_<id>; ids — список строк. */
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

    const price = parseMoney(formData.get(`price_${id}`));
    const oldPrice = parseMoney(formData.get(`old_${id}`));
    const costPrice = parseMoney(formData.get(`cost_${id}`));
    if (price === "bad" || oldPrice === "bad" || costPrice === "bad") {
      errors.push(`${title}: цена должна быть числом.`);
      continue;
    }

    const result = check({
      id,
      title,
      price,
      oldPrice,
      costPrice,
      isSale: formData.get(`sale_${id}`) === "on",
    });
    if (result.ok) patches.push(result.patch);
    else errors.push(result.error);
  }

  if (errors.length) {
    return { error: `Не сохранено. ${errors.slice(0, 5).join(" ")}${errors.length > 5 ? ` …и ещё ${errors.length - 5}.` : ""}` };
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

  const text = await file.text();
  const parsed = parsePricingCsv(text);
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
    // существующем столбце — «очистить»: так убирают старую цену.
    const result = check({
      id: current.id,
      title: current.title,
      price: item.price ?? current.price,
      oldPrice: item.oldPrice === undefined ? current.oldPrice : item.oldPrice,
      costPrice: item.costPrice === undefined ? current.costPrice : item.costPrice,
      isSale: item.isSale === undefined ? current.isSale : item.isSale,
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
