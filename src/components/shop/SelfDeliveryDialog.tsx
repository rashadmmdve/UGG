"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/hooks/useHydrated";

/**
 * Окно после оформления для городов, куда возим сами.
 *
 * Такой заказ не уходит в СДЭК, и покупателю неоткуда узнать, что
 * происходит: трек-номера не будет, письмо о доставке молчит. Поэтому
 * сразу после оформления говорим прямо — заказ готовится, свяжемся.
 *
 * Окно открывается само и закрывается по кнопке, Escape или щелчку мимо:
 * это сообщение, а не выбор, задерживать им человека незачем.
 */
export function SelfDeliveryDialog() {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(true);

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

  if (!hydrated || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Заказ принят"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-end justify-center bg-fg/40 sm:items-center sm:p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md border border-line bg-bg p-6 text-left md:p-8"
      >
        <h2 className="font-display text-2xl">Ваш товар готовится</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Заказ по вашему городу мы доставляем сами — скоро свяжемся с вами и
          согласуем время. Трек-номер по такому заказу не выдаётся.
        </p>
        <div className="mt-8">
          <Button type="button" onClick={() => setOpen(false)} className="w-full">
            Понятно
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
