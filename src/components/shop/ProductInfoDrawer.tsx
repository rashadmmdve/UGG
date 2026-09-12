"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useHydrated } from "@/lib/hooks/useHydrated";
import type { ProductSpec } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "description" | "specs";

/**
 * Панель «Характеристики» справа — до середины экрана на компьютере, во
 * всю ширину на телефоне. Две вкладки, как у поставщика: «Описание» с
 * текстом о модели и «Характеристики» таблицей.
 *
 * Описание — готовая разметка (абзацы, списки), поэтому вставляется как
 * HTML: она приходит из админки, а не от посетителей.
 */
export function ProductInfoDrawer({
  description,
  specs,
}: {
  description: string;
  specs: ProductSpec[];
}) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(description ? "description" : "specs");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!description && specs.length === 0) return null;

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={cn(
        "relative px-1 pb-3 text-sm font-semibold transition-colors",
        tab === value ? "text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Текстом с линией снизу, не кнопкой: чтобы не спутать с размерами.
        className="mt-6 inline-block border-b border-fg pb-0.5 text-sm font-medium transition-colors hover:text-muted hover:border-muted"
      >
        Характеристики
      </button>

      {hydrated &&
        createPortal(
          <div aria-hidden={!open} className={cn("fixed inset-0 z-50 overflow-hidden", !open && "pointer-events-none")}>
            <button
              type="button"
              aria-label="Закрыть"
              tabIndex={open ? undefined : -1}
              onClick={() => setOpen(false)}
              className={cn("absolute inset-0 bg-fg/30 transition-opacity duration-500", open ? "opacity-100" : "opacity-0")}
            />
            <aside
              role="dialog"
              aria-label="Описание и характеристики"
              inert={!open}
              className={cn(
                // Уже половины экрана и с плавным замедлением к концу хода.
                "absolute inset-y-0 right-0 flex w-full flex-col bg-bg shadow-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:w-[40%] lg:max-w-2xl",
                open ? "translate-x-0" : "translate-x-full",
              )}
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6">
                <div role="tablist" className="flex gap-6 pt-3">
                  {description && tabButton("description", "Описание")}
                  {specs.length > 0 && tabButton("specs", "Характеристики")}
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="-mr-2 flex h-10 w-10 items-center justify-center">
                  <X className="h-5 w-5" strokeWidth={1.6} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {tab === "description" && description && (
                  <div className="prose-seo text-[0.9375rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: description }} />
                )}
                {tab === "specs" && specs.length > 0 && (
                  <dl className="divide-y divide-line text-sm">
                    {specs.map((spec) => (
                      <div key={spec.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-2.5">
                        <dt className="text-muted">{spec.label}</dt>
                        <dd>{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
