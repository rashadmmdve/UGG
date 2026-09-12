"use client";

import { useEffect, useState } from "react";

import { setProductsPublishedAction } from "@/server/admin/actions/catalog";

/**
 * Панель массовых действий над списком товаров.
 *
 * Галочки стоят в строках таблицы и привязаны к этой форме через
 * атрибут form — сама таблица остаётся серверной. Панель показывает,
 * сколько отмечено, и даёт скрыть или показать выбранное одним нажатием.
 */
export const BULK_FORM_ID = "bulk-products";

export function BulkPublishBar({ total }: { total: number }) {
  const [selected, setSelected] = useState(0);

  const count = () => {
    const form = document.getElementById(BULK_FORM_ID) as HTMLFormElement | null;
    setSelected(form ? new FormData(form).getAll("ids").length : 0);
  };

  // Галочки лежат в таблице, а не внутри формы, поэтому их change до формы
  // не долетает — слушаем на документе.
  useEffect(() => {
    const onChange = (event: Event) => {
      if ((event.target as HTMLInputElement | null)?.getAttribute("form") === BULK_FORM_ID) count();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  });

  function toggleAll(checked: boolean) {
    document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM_ID}"][name="ids"]`).forEach((box) => {
      box.checked = checked;
    });
    count();
  }

  const button = "h-8 rounded border px-3 text-xs font-medium disabled:opacity-40";

  return (
    <form
      id={BULK_FORM_ID}
      action={setProductsPublishedAction}
      className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-elevated px-4 py-2 text-sm"
    >
      <label className="flex items-center gap-2">
        <input type="checkbox" onChange={(event) => toggleAll(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        Выбрать все ({total})
      </label>
      <span className="text-muted">Отмечено: {selected}</span>
      <div className="ml-auto flex gap-2">
        <button type="submit" name="publish" value="0" disabled={selected === 0} className={`${button} border-line hover:border-accent`}>
          Скрыть выбранные
        </button>
        <button type="submit" name="publish" value="1" disabled={selected === 0} className={`${button} border-accent bg-accent text-white hover:bg-accent-hover`}>
          Показать выбранные
        </button>
      </div>
    </form>
  );
}

/** Галочка в строке товара — привязана к форме панели. */
export function BulkCheckbox({ id }: { id: string }) {
  return (
    <input
      type="checkbox"
      name="ids"
      value={id}
      form={BULK_FORM_ID}
      aria-label="Выбрать товар"
      className="h-4 w-4 accent-[var(--accent)]"
    />
  );
}
