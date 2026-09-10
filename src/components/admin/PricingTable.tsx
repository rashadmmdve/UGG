"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { savePricingAction } from "@/server/admin/actions/pricing";
import { basePrice, salePrice } from "@/lib/pricing";
import type { PricingRow } from "@/server/repositories/pricing";
import type { ActionState } from "@/server/validation/errors";

const GENDER: Record<string, string> = { women: "Ж", men: "М", kids: "Д", unisex: "У" };

/**
 * Таблица цен. Цена, цена со скидкой и себестоимость — управляемые
 * поля: от них живьём считается маржа (от той цены, что действует —
 * скидочной, если она есть). Галочки — обычные поля формы.
 */
export function PricingTable({ rows }: { rows: PricingRow[] }) {
  const [state, action] = useActionState<ActionState, FormData>(savePricingAction, {});
  const [values, setValues] = useState<Record<string, { base: string; sale: string; cost: string }>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          base: String(basePrice(row)),
          sale: salePrice(row) === null ? "" : String(salePrice(row)),
          cost: row.costPrice === null ? "" : String(row.costPrice),
        },
      ]),
    ),
  );

  const set = (id: string, key: "base" | "sale" | "cost", value: string) =>
    setValues((v) => ({ ...v, [id]: { ...v[id], [key]: value } }));

  const effective = (id: string) => {
    const v = values[id];
    const sale = Number(v?.sale), base = Number(v?.base);
    return v?.sale && Number.isFinite(sale) ? sale : base;
  };
  const margin = (id: string) => {
    const v = values[id];
    const price = effective(id), cost = Number(v?.cost);
    if (!v?.cost || !Number.isFinite(price) || !Number.isFinite(cost) || price <= 0) return null;
    return Math.round(((price - cost) / price) * 100);
  };
  const discount = (id: string) => {
    const v = values[id];
    const sale = Number(v?.sale), base = Number(v?.base);
    if (!v?.sale || !Number.isFinite(sale) || !Number.isFinite(base) || base <= 0 || sale >= base) return null;
    return Math.round((1 - sale / base) * 100);
  };

  const input =
    "h-8 w-24 rounded border border-line bg-bg px-2 text-right text-sm tabular-nums outline-none focus:border-accent";

  return (
    <form action={action} noValidate>
      <input type="hidden" name="ids" value={JSON.stringify(rows.map((row) => row.id))} />

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/95 py-3 backdrop-blur-sm">
        <FormMessage error={state.error} success={state.success} />
        <SubmitButton className="ml-auto">Сохранить</SubmitButton>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-normal">Товар</th>
              <th className="px-3 py-2 font-normal">Артикул</th>
              <th className="px-3 py-2 text-right font-normal">Цена</th>
              <th className="px-3 py-2 text-right font-normal">Со скидкой</th>
              <th className="px-3 py-2 text-right font-normal">Скидка</th>
              <th className="px-3 py-2 text-right font-normal">Себестоимость</th>
              <th className="px-3 py-2 text-right font-normal">Маржа</th>
              <th className="px-3 py-2 text-center font-normal">Распродажа</th>
              <th className="px-3 py-2 text-center font-normal">Хиты</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const m = margin(row.id), d = discount(row.id);
              const v = values[row.id];
              return (
                <tr key={row.id} className={row.isPublished ? "hover:bg-sand" : "opacity-60 hover:bg-sand"}>
                  <td className="px-3 py-1.5">
                    <Link href={`/admin/products/${row.id}`} className="font-medium hover:text-accent">
                      {row.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted">{GENDER[row.gender] ?? ""}</span>
                    {!row.isPublished && <span className="ml-2 text-xs text-muted">скрыт</span>}
                  </td>
                  <td className="px-3 py-1.5 text-muted">{row.sku ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input name={`base_${row.id}`} inputMode="numeric" value={v?.base ?? ""}
                      onChange={(e) => set(row.id, "base", e.target.value)}
                      aria-label={`Цена: ${row.title}`} className={input} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input name={`sale_${row.id}`} inputMode="numeric" value={v?.sale ?? ""}
                      onChange={(e) => set(row.id, "sale", e.target.value)} placeholder="—"
                      aria-label={`Цена со скидкой: ${row.title}`} className={input} />
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${d === null ? "text-muted" : "text-success"}`}>
                    {d === null ? "—" : `−${d}%`}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input name={`cost_${row.id}`} inputMode="numeric" value={v?.cost ?? ""}
                      onChange={(e) => set(row.id, "cost", e.target.value)} placeholder="—"
                      aria-label={`Себестоимость: ${row.title}`} className={input} />
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${m !== null && m < 0 ? "text-danger" : "text-muted"}`}>
                    {m === null ? "—" : `${m}%`}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" name={`insale_${row.id}`} defaultChecked={row.isSale}
                      aria-label={`В распродаже: ${row.title}`} className="h-4 w-4 accent-[var(--accent)]" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" name={`hit_${row.id}`} defaultChecked={row.isBestseller}
                      aria-label={`В хитах: ${row.title}`} className="h-4 w-4 accent-[var(--accent)]" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </form>
  );
}
