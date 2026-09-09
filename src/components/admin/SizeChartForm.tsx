"use client";

import { useActionState, useState } from "react";

import { AField, ASelect, FormMessage, SubmitButton } from "@/components/admin/ui";
import { slugify } from "@/lib/utils";
import { saveSizeChartAction } from "@/server/admin/actions/catalog";
import type { ActionState } from "@/server/validation/errors";
import type { Gender, SizeChart } from "@/lib/types";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "women", label: "Женская" },
  { value: "men", label: "Мужская" },
  { value: "kids", label: "Детская" },
  { value: "unisex", label: "Унисекс" },
];

type Row = {
  key: number;
  sizeEu: string;
  sizeUs: string;
  sizeUk: string;
  insoleCm: string;
};

let counter = 0;

export function SizeChartForm({ chart }: { chart: SizeChart | null }) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveSizeChartAction,
    {},
  );
  const isNew = chart === null;

  const [title, setTitle] = useState(chart?.title ?? "");
  const [slug, setSlug] = useState(chart?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [rows, setRows] = useState<Row[]>(
    (chart?.rows ?? []).map((row) => ({
      key: ++counter,
      sizeEu: String(row.sizeEu),
      sizeUs: row.sizeUs ?? "",
      sizeUk: row.sizeUk ?? "",
      insoleCm: String(row.insoleCm),
    })),
  );

  const errors = state.fieldErrors ?? {};

  function update(key: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    // Новая строка продолжает ряд: следующий размер и стелька +0.5 см —
    // так сетка набивается почти без ввода.
    const last = rows[rows.length - 1];
    setRows((current) => [
      ...current,
      {
        key: ++counter,
        sizeEu: last ? String(Number(last.sizeEu) + 1) : "",
        sizeUs: "",
        sizeUk: "",
        insoleCm: last ? String(Number(last.insoleCm) + 0.5) : "",
      },
    ]);
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      {chart && <input type="hidden" name="id" value={chart.id} />}
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify(
          rows.map(({ sizeEu, sizeUs, sizeUk, insoleCm }) => ({
            sizeEu,
            sizeUs,
            sizeUk,
            insoleCm,
          })),
        )}
      />

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <AField
            id="title"
            name="title"
            label="Название"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            error={errors.title}
          />
          <AField
            id="slug"
            name="slug"
            label="Код"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            error={errors.slug}
          />
          <ASelect
            id="gender"
            name="gender"
            label="Тип"
            defaultValue={chart?.gender ?? "women"}
            options={GENDERS}
            error={errors.gender}
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Размеры</h2>
          <button
            type="button"
            onClick={addRow}
            className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent"
          >
            + Строка
          </button>
        </div>
        {errors.rows && <p className="mt-2 text-xs text-danger">{errors.rows}</p>}

        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2 pr-3 font-normal">EU</th>
              <th className="pb-2 pr-3 font-normal">US</th>
              <th className="pb-2 pr-3 font-normal">UK</th>
              <th className="pb-2 pr-3 font-normal">Стелька, см</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <td className="py-1.5 pr-3">
                  <input type="number" step="0.5" value={row.sizeEu} aria-label="EU"
                    onChange={(e) => update(row.key, { sizeEu: e.target.value })}
                    className="w-20 rounded border border-line px-2 py-1" />
                </td>
                <td className="py-1.5 pr-3">
                  <input value={row.sizeUs} aria-label="US"
                    onChange={(e) => update(row.key, { sizeUs: e.target.value })}
                    className="w-20 rounded border border-line px-2 py-1" />
                </td>
                <td className="py-1.5 pr-3">
                  <input value={row.sizeUk} aria-label="UK"
                    onChange={(e) => update(row.key, { sizeUk: e.target.value })}
                    className="w-20 rounded border border-line px-2 py-1" />
                </td>
                <td className="py-1.5 pr-3">
                  <input type="number" step="0.5" value={row.insoleCm} aria-label="Длина стельки"
                    onChange={(e) => update(row.key, { insoleCm: e.target.value })}
                    className="w-24 rounded border border-line px-2 py-1" />
                </td>
                <td className="py-1.5 text-right">
                  <button type="button" aria-label="Удалить строку"
                    onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))}
                    className="text-muted hover:text-danger">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex justify-end">
        <SubmitButton>{isNew ? "Создать сетку" : "Сохранить"}</SubmitButton>
      </div>
    </form>
  );
}
