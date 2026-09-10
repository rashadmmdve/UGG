"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";

import { payOrderAction } from "@/server/orders/actions";

/**
 * Кнопка «Оплатить» на странице после оформления: заводит (или
 * переиспользует) платёж и уводит покупателя на страницу ЮKassa.
 */
export function PayOrderButton({ orderId, label = "Оплатить заказ" }: { orderId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await payOrderAction(orderId);
      if (result.ok) window.location.assign(result.url);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        <CreditCard className="h-4 w-4" strokeWidth={1.6} />
        {pending ? "Открываем оплату…" : label}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
