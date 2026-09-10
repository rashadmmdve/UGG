"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { savePricingAction } from "@/server/admin/actions/pricing";
import type { PricingRow } from "@/server/repositories/pricing";
import type { ActionState } from "@/server/validation/errors";

const GENDER: Record<string, string> = { women: "Ж", men: "М", kids: "Д", unisex: "У" };

/**
 * Таблица цен. Цена и себестоимость — управляемые поля: от них живьём
 * считается маржа. Старая цена и галочка распродажи — обычные поля,
 * их значения читает форма при отправке.
 */
export function PricingTable({ rows }: { rows: PricingRow[] }) {
  const [state, action] = useActionState<ActionState, FormData>(savePricingAction, {});
  const [values, setValues] = useState<Record<string, { price: string; cost: string }>>(() =>
    Object.fromEntries(
      rows.map((row) => [row.id, { price: String(row.price), cost: row.costPrice === null ? "" : String(row.costPrice) }]),
    ),
  );

  const margin = (id: string) => {
    const v = values[id];
    const price = Number(v?.price);
    const cost = Number(v?.cost);
    if (!v?.cost || !Number.isFinite(price) || !Number.isFinite(cost) || price <= 0) return null;
    return Math.round(((price - cost) / price) * 100);
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
              <th className="px-3 py-2 text-right font-normal">Старая</th>
              <th className="px-3 py-2 text-right font-normal">Себестоимость</th>
              <th className="px-3 py-2 text-right font-normal">Маржа</th>
              <th className="px-3 py-2 text-center font-normal">Распродажа</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const m = margin(row.id);
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
                    <input
                      name={`price_${row.id}`}
                      inputMode="numeric"
                      value={values[row.id]?.price ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [row.id]: { ...v[row.id], price: e.target.value } }))}
                      aria-label={`Цена: ${row.title}`}
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      name={`old_${row.id}`}
                      inputMode="numeric"
                      defaultValue={row.oldPrice ?? ""}
                      placeholder="—"
                      aria-label={`Старая цена: ${row.title}`}
                      className={input}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      name={`cost_${row.id}`}
                      inputMode="numeric"
                      value={values[row.id]?.cost ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [row.id]: { ...v[row.id], cost: e.target.value } }))}
                      placeholder="—"
                      aria-label={`Себестоимость: ${row.title}`}
                      className={input}
                    />
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${m !== null && m < 0 ? "text-danger" : "text-muted"}`}>
                    {m === null ? "—" : `${m}%`}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      name={`sale_${row.id}`}
                      defaultChecked={row.isSale}
                      aria-label={`В распродаже: ${row.title}`}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
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
