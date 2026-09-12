"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";

import { BULK_FORM_ID } from "@/components/admin/BulkPublish";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type AdminProductRow = {
  id: string;
  title: string;
  slug: string;
  sku: string | null;
  price: number;
  stock: number;
  published: boolean;
};

export type AdminProductGroup = {
  key: string;
  title: string;
  categories: { key: string; title: string; items: AdminProductRow[] }[];
};

/**
 * Таблица товаров в админке: разделы и категории сворачиваются, у каждой
 * группы своя галочка «выбрать всё внутри».
 *
 * Галочки строк — те же, что у панели массовых действий: привязаны к её
 * форме атрибутом form. Групповая галочка просто проставляет их через
 * DOM и шлёт change, чтобы панель пересчитала отмеченное; хранить выбор
 * ещё и в состоянии React значило бы держать две копии одного списка.
 */
export function AdminProductTable({ groups }: { groups: AdminProductGroup[] }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function selectScope(scope: string, checked: boolean) {
    const boxes = document.querySelectorAll<HTMLInputElement>(
      `input[form="${BULK_FORM_ID}"][data-scope~="${scope}"]`,
    );
    boxes.forEach((box) => {
      box.checked = checked;
    });
    boxes[0]?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
      <table className="w-full text-sm">
        <thead className="bg-elevated text-left text-xs text-muted">
          <tr>
            <th className="w-8 px-3 py-2" />
            <th className="px-4 py-2 font-normal">Название</th>
            <th className="px-4 py-2 font-normal">Артикул</th>
            <th className="px-4 py-2 text-right font-normal">Цена</th>
            <th className="px-4 py-2 text-right font-normal">Остаток</th>
            <th className="px-4 py-2 font-normal">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {groups.map((group) => {
            const groupClosed = closed.has(group.key);
            const total = group.categories.reduce((sum, category) => sum + category.items.length, 0);

            return (
              <Fragment key={group.key}>
                <tr className="bg-sand">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Выбрать раздел ${group.title}`}
                      onChange={(event) => selectScope(group.key, event.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </td>
                  <td colSpan={5} className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      aria-expanded={!groupClosed}
                      className="flex items-center gap-1.5 text-sm font-bold"
                    >
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform", groupClosed && "-rotate-90")}
                        strokeWidth={2}
                      />
                      {group.title} <span className="font-normal text-muted">{total}</span>
                    </button>
                  </td>
                </tr>

                {!groupClosed &&
                  group.categories.map((category) => {
                    const categoryClosed = closed.has(category.key);

                    return (
                      <Fragment key={category.key}>
                        <tr className="bg-elevated">
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              aria-label={`Выбрать категорию ${category.title}`}
                              onChange={(event) => selectScope(category.key, event.target.checked)}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                          </td>
                          <td colSpan={5} className="px-4 py-1.5">
                            <button
                              type="button"
                              onClick={() => toggle(category.key)}
                              aria-expanded={!categoryClosed}
                              className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase"
                            >
                              <ChevronDown
                                className={cn("h-3.5 w-3.5 transition-transform", categoryClosed && "-rotate-90")}
                                strokeWidth={2}
                              />
                              {category.title} <span className="font-normal">{category.items.length}</span>
                            </button>
                          </td>
                        </tr>

                        {!categoryClosed &&
                          category.items.map((product) => (
                            <tr key={product.id} className="hover:bg-sand">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  name="ids"
                                  value={product.id}
                                  form={BULK_FORM_ID}
                                  data-scope={`${group.key} ${category.key}`}
                                  aria-label={`Выбрать ${product.title}`}
                                  className="h-4 w-4 accent-[var(--accent)]"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <Link href={`/admin/products/${product.id}`} className="font-medium hover:text-accent">
                                  {product.title}
                                </Link>
                                <span className="block text-xs text-muted">/product/{product.slug}</span>
                              </td>
                              <td className="px-4 py-2 text-muted">{product.sku ?? "—"}</td>
                              <td className="px-4 py-2 text-right">{formatPrice(product.price)}</td>
                              <td className={cn("px-4 py-2 text-right", product.stock === 0 && "text-danger")}>
                                {product.stock}
                              </td>
                              <td className="px-4 py-2">
                                {product.published ? (
                                  <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">
                                    Опубликован
                                  </span>
                                ) : (
                                  <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">Черновик</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
