import "server-only";

import type { PricingRow } from "@/server/repositories/pricing";

/**
 * CSV для массовой правки цен: скачал, поправил в Excel, загрузил.
 *
 * Разделитель — точка с запятой и BOM в начале: русский Excel открывает
 * такой файл сразу в колонки и с кириллицей, а без BOM показывает
 * кракозябры. При загрузке разделитель определяется по заголовку, так
 * что файл, пересохранённый через запятую или табуляцию, тоже примется.
 */

export const CSV_COLUMNS = [
  "ID",
  "Артикул",
  "Название",
  "Цена",
  "Старая цена",
  "Себестоимость",
  "Распродажа",
] as const;

const quote = (value: string | number | null) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r,\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function pricingToCsv(rows: PricingRow[]): string {
  const lines = [
    CSV_COLUMNS.join(";"),
    ...rows.map((row) =>
      [
        row.id,
        row.sku ?? "",
        row.title,
        row.price,
        row.oldPrice ?? "",
        row.costPrice ?? "",
        row.isSale ? "да" : "нет",
      ]
        .map(quote)
        .join(";"),
    ),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export type ParsedPricing = {
  id: string | null;
  sku: string | null;
  price: number | null;
  oldPrice: number | null | undefined;
  costPrice: number | null | undefined;
  isSale: boolean | undefined;
  line: number;
};

/** Число из ячейки: «13 990 ₽», «13990,00», «13990». Пусто — null. */
function parseMoney(raw: string): number | null | "bad" {
  const text = raw.replace(/[\s ₽руб.]/gi, "").replace(",", ".");
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return "bad";
  return Math.round(value);
}

function parseFlag(raw: string): boolean | undefined | "bad" {
  const text = raw.trim().toLowerCase();
  if (text === "") return undefined;
  if (["да", "yes", "1", "true", "+", "x", "✓"].includes(text)) return true;
  if (["нет", "no", "0", "false", "-", "−"].includes(text)) return false;
  return "bad";
}

/** Разбор одной строки с учётом кавычек. */
function splitLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === separator) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

const normalize = (s: string) => s.replace(/^﻿/, "").trim().toLowerCase();

export function parsePricingCsv(text: string): { rows: ParsedPricing[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const errors: string[] = [];
  if (lines.length < 2) {
    return { rows: [], errors: ["В файле нет строк с товарами."] };
  }

  // Разделитель — тот, которого в заголовке больше.
  const header = lines[0];
  const separator = [";", ",", "\t"]
    .map((s) => ({ s, n: header.split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s;

  const columns = splitLine(header, separator).map(normalize);
  const index = (name: string) => columns.indexOf(normalize(name));
  const col = {
    id: index("ID"),
    sku: index("Артикул"),
    price: index("Цена"),
    oldPrice: index("Старая цена"),
    costPrice: index("Себестоимость"),
    isSale: index("Распродажа"),
  };

  if (col.id < 0 && col.sku < 0) {
    return { rows: [], errors: ["Нет столбца «ID» или «Артикул» — по ним ищется товар."] };
  }
  if (col.price < 0 && col.oldPrice < 0 && col.costPrice < 0 && col.isSale < 0) {
    return { rows: [], errors: ["Нет ни одного столбца с данными: «Цена», «Старая цена», «Себестоимость», «Распродажа»."] };
  }

  const rows: ParsedPricing[] = [];
  const cell = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "") : "");

  lines.slice(1).forEach((line, offset) => {
    const number = offset + 2;
    const cells = splitLine(line, separator);
    const id = cell(cells, col.id) || null;
    const sku = cell(cells, col.sku) || null;
    if (!id && !sku) {
      errors.push(`Строка ${number}: нет ни ID, ни артикула.`);
      return;
    }

    const price = col.price >= 0 ? parseMoney(cell(cells, col.price)) : undefined;
    const oldPrice = col.oldPrice >= 0 ? parseMoney(cell(cells, col.oldPrice)) : undefined;
    const costPrice = col.costPrice >= 0 ? parseMoney(cell(cells, col.costPrice)) : undefined;
    const isSale = col.isSale >= 0 ? parseFlag(cell(cells, col.isSale)) : undefined;

    if (price === "bad" || oldPrice === "bad" || costPrice === "bad") {
      errors.push(`Строка ${number}: цена должна быть числом.`);
      return;
    }
    if (isSale === "bad") {
      errors.push(`Строка ${number}: в «Распродаже» ожидается «да» или «нет».`);
      return;
    }
    // Цена обязательна, если столбец есть: пустая цена — это ошибка,
    // а не «оставить как было».
    if (col.price >= 0 && price === null) {
      errors.push(`Строка ${number}: цена пустая.`);
      return;
    }

    rows.push({
      id,
      sku,
      price: price === undefined ? null : price,
      oldPrice,
      costPrice,
      isSale,
      line: number,
    });
  });

  return { rows, errors };
}
