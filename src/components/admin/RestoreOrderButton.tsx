"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";

import { FormMessage } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { restoreOrderAction } from "@/server/admin/actions/orders";

/**
 * Вернуть отменённый заказ в работу.
 *
 * С подтверждением: отмена вернула товары в каталог, и восстановление
 * снова их списывает — если за это время их раскупили, действие
 * откажет и скажет об этом.
 */
export function RestoreOrderButton({ orderNumber, orderId }: { orderNumber: string; orderId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      const result = await restoreOrderAction(orderId);
      setOpen(false);
      setMessage(result.ok ? { success: "Заказ снова в работе" } : { error: result.error });
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.7} />
        Восстановить заказ
      </button>

      <div className="mt-3">
        <FormMessage error={message.error} success={message.success} />
      </div>

      <ConfirmDialog
        open={open}
        title={`Вернуть заказ ${orderNumber} в работу?`}
        description="Товары снова спишутся со склада — если их успели раскупить, восстановить не получится. Отправление в СДЭК не вернётся: создайте его заново кнопкой «Передать в СДЭК»."
        confirmLabel="Восстановить"
        cancelLabel="Не надо"
        pending={pending}
        onConfirm={restore}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
