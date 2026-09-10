import "server-only";

import { getDb, transaction } from "@/server/db/connection";
import { nowIso } from "@/server/db/mappers";
import type { Gender } from "@/lib/types";

/**
 * Цены отдельно от карточки товара.
 *
 * Блок «Цены» в админке работает со всем каталогом сразу — восемьсот
 * строк. Тянуть ради четырёх чисел на строку полный товар с размерами,
 * категориями и фото было бы дорого, поэтому здесь своя узкая выборка
 * и своя запись, которая трогает только ценовые столбцы.
 */

export type PricingRow = {
  id: string;
  sku: string | null;
  title: string;
  slug: string;
  gender: Gender;
  price: number;
  oldPrice: number | null;
  costPrice: number | null;
  isSale: boolean;
  isPublished: boolean;
};

type Row = {
  id: string;
  sku: string | null;
  title: string;
  slug: string;
  gender: string;
  price: number;
  old_price: number | null;
  cost_price: number | null;
  is_sale: number;
  is_published: number;
};

export function getPricingRows(): PricingRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, sku, title, slug, gender, price, old_price, cost_price, is_sale, is_published
       FROM products
       ORDER BY gender, title`,
    )
    .all() as Row[];

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    title: row.title,
    slug: row.slug,
    gender: row.gender as Gender,
    price: row.price,
    oldPrice: row.old_price,
    costPrice: row.cost_price,
    isSale: row.is_sale === 1,
    isPublished: row.is_published === 1,
  }));
}

export type PricingPatch = {
  id: string;
  price: number;
  oldPrice: number | null;
  costPrice: number | null;
  isSale: boolean;
};

/**
 * Применить правки. Пишутся только строки, где что-то изменилось:
 * так updated_at не сдвигается у восьмисот нетронутых товаров, и в
 * ответ можно честно сказать, сколько карточек поменялось.
 */
export function applyPricing(patches: PricingPatch[]): number {
  return transaction(() => {
    const db = getDb();
    const read = db.prepare(
      "SELECT price, old_price, cost_price, is_sale FROM products WHERE id = ?",
    );
    const write = db.prepare(
      `UPDATE products
       SET price = ?, old_price = ?, cost_price = ?, is_sale = ?, updated_at = ?
       WHERE id = ?`,
    );
    const now = nowIso();
    let changed = 0;

    for (const patch of patches) {
      const current = read.get(patch.id) as
        | { price: number; old_price: number | null; cost_price: number | null; is_sale: number }
        | undefined;
      if (!current) continue;

      const same =
        current.price === patch.price &&
        current.old_price === patch.oldPrice &&
        current.cost_price === patch.costPrice &&
        current.is_sale === (patch.isSale ? 1 : 0);
      if (same) continue;

      write.run(patch.price, patch.oldPrice, patch.costPrice, patch.isSale ? 1 : 0, now, patch.id);
      changed++;
    }

    return changed;
  });
}
