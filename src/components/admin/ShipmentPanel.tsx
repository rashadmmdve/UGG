"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  cancelOrderAction,
  refreshShipmentAction,
  registerShipmentAction,
} from "@/server/admin/actions/orders";
import type { CdekShipment } from "@/lib/types";

/**
 * Панель отправления СДЭК на странице заказа.
 *
 * Регистрация в СДЭК при оформлении может не пройти (сервис недоступен,
 * ошибка валидации адреса) — тогда заказ живёт только у нас, и отсюда
 * менеджер передаёт его вручную.
 */
export function ShipmentPanel({
  orderId,
  orderNumber,
  shipment,
  canCancel,
  isCancelled,
  selfDelivery,
}: {
  orderId: string;
  orderNumber: string;
  shipment: CdekShipment | null;
  canCancel: boolean;
  isCancelled: boolean;
  /** Город, куда возим сами: в СДЭК такой заказ автоматически не уходит. */
  selfDelivery: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  function register() {
    startTransition(async () => {
      const result = await registerShipmentAction(orderId);
      setMessage(result.ok ? { success: "Отправление создано в СДЭК" } : { error: result.error });
    });
  }

  function refresh() {
    startTransition(async () => {
      await refreshShipmentAction(orderId);
      setMessage({ success: "Статус обновлён" });
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      setConfirmOpen(false);
      setMessage(result.ok ? { success: "Заказ отменён, остатки возвращены" } : { error: result.error });
    });
  }

  const button = "rounded border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60";

  return (
    <section className="rounded-lg border border-line bg-bg p-5">
      <h2 className="font-semibold">Доставка СДЭК</h2>

      <div className="mt-3">
        <FormMessage error={message.error} success={message.success} />
      </div>

      {shipment ? (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Трек-номер</dt>
          <dd className="font-mono">{shipment.cdekNumber ?? "ещё не присвоен"}</dd>
          <dt className="text-muted">Статус</dt>
          <dd>{shipment.statusName} <span className="text-xs text-muted">({shipment.statusCode})</span></dd>
          <dt className="text-muted">Проверено</dt>
          <dd className="text-muted">{new Date(shipment.syncedAt).toLocaleString("ru-RU")}</dd>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          {isCancelled
            ? "Заказ отменён, отправления нет."
            : selfDelivery
              ? "Доставка своими силами: в СДЭК заказ не передавался, трек-номера у него нет. Свяжитесь с покупателем и согласуйте доставку. Передать в СДЭК всё равно можно — кнопкой ниже."
              : "Заказ не передан в СДЭК. Передайте вручную, когда будет готов к отправке."}
        </p>
      )}

      {!isCancelled && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shipment ? (
            <>
              <button type="button" onClick={refresh} disabled={pending} className={button}>
                Обновить статус
              </button>
              <a
                href={`/api/orders/${orderId}/label`}
                target="_blank"
                rel="noopener"
                className={button}
              >
                Этикетка PDF
              </a>
            </>
          ) : (
            <button type="button" onClick={register} disabled={pending} className={button}>
              Передать в СДЭК
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              className="ml-auto rounded border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/5 disabled:opacity-60"
            >
              Отменить заказ
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Отменить заказ ${orderNumber}?`}
        description="Остатки вернутся в каталог, отправление в СДЭК будет удалено. Вернуть заказ обратно после отмены нельзя."
        confirmLabel="Отменить заказ"
        cancelLabel="Не отменять"
        pending={pending}
        onConfirm={cancel}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  );
}
