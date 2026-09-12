"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/admin/ui";
import { assignCourierAction } from "@/server/admin/actions/couriers";
import type { Courier } from "@/server/repositories/couriers";

/**
 * Кому везти. Сохраняется сразу при выборе: лишняя кнопка «ОК» на
 * действии, которое оператор делает десятками за смену, только мешает.
 */
export function CourierPicker({
  orderId,
  courierId,
  couriers,
}: {
  orderId: string;
  courierId: string | null;
  couriers: Courier[];
}) {
  const [value, setValue] = useState(courierId ?? "");
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  function assign(next: string) {
    setValue(next);
    startTransition(async () => {
      const result = await assignCourierAction(orderId, next || null);
      setMessage(
        result.ok
          ? { success: next ? "Курьер назначен, заказ ушёл ему в Телеграм" : "Назначение снято" }
          : { error: result.error },
      );
    });
  }

  return (
    <div>
      <select
        value={value}
        disabled={pending}
        onChange={(event) => assign(event.target.value)}
        aria-label="Курьер"
        className="w-full rounded border border-line bg-bg px-3 py-2 text-sm disabled:opacity-60"
      >
        <option value="">Не назначен</option>
        {couriers.map((courier) => (
          <option key={courier.id} value={courier.id}>
            {courier.name}
            {courier.telegramId ? "" : " (нет Телеграма)"}
          </option>
        ))}
      </select>

      <div className="mt-2">
        <FormMessage error={message.error} success={message.success} />
      </div>
    </div>
  );
}
