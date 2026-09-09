"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, Eye, X } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { cancelOrderAction, refreshOrderStatusAction } from "@/server/orders/actions";
import type { Order } from "@/lib/types";

/** Как часто спрашиваем у СДЭК свежий статус, пока страница открыта. */
const POLL_MS = 30_000;

/**
 * Заказ в личном кабинете: номер, трек, статус доставки, этикетка и отмена.
 * Статус подтягивается сам, без перезагрузки: посылка едет часами.
 */
export function OrderCard({ order }: { order: Order }) {
  const [status, setStatus] = useState(order.status);
  const [shipment, setShipment] = useState(order.cdek);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, startCancel] = useTransition();

  const settled = status === "cancelled" || status === "completed";

  useEffect(() => {
    if (settled || !shipment) return;
    let cancelled = false;
    const tick = async () => {
      const fresh = await refreshOrderStatusAction(order.id);
      if (cancelled || !fresh) return;
      setStatus(fresh.status);
      setShipment((current) =>
        current
          ? {
              ...current,
              statusCode: fresh.statusCode ?? current.statusCode,
              statusName: fresh.statusName ?? current.statusName,
              cdekNumber: fresh.cdekNumber ?? current.cdekNumber,
            }
          : current,
      );
    };
    const id = setInterval(tick, POLL_MS);
    const first = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(first);
    };
  }, [order.id, settled, shipment]);

  // Этикетку отдаёт наш обработчик, а не СДЭК напрямую: файл у них
  // защищён токеном, которого у браузера нет.
  function openLabel(download: boolean) {
    window.open(`/api/orders/${order.id}/label${download ? "?download=1" : ""}`, download ? "_self" : "_blank");
  }

  function handleCancel() {
    setError(null);
    startCancel(async () => {
      const result = await cancelOrderAction(order.id);
      if (result.ok) {
        setStatus("cancelled");
        setShipment(null);
      } else {
        setError(result.error);
      }
      setConfirmOpen(false);
    });
  }

  const cancellable = status !== "cancelled" && status !== "completed" && status !== "shipped";
  const button = "inline-flex h-9 items-center gap-1.5 rounded border border-line px-3 text-sm hover:border-accent disabled:opacity-60";

  return (
    <article className={cn("rounded-lg border p-5", status === "cancelled" ? "border-line/60 opacity-60" : "border-line")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-semibold">{order.number}</p>
          <p className="mt-0.5 text-xs text-muted">{formatDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatPrice(order.total)}</p>
          <p className="mt-0.5 text-xs text-muted">{ORDER_STATUS_LABELS[status]}</p>
        </div>
      </div>

      <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
        {shipment?.cdekNumber && (
          <div className="flex justify-between gap-4"><dt className="text-muted">Трек-номер СДЭК</dt><dd className="font-mono">{shipment.cdekNumber}</dd></div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Статус доставки</dt>
          <dd className="text-right">{shipment?.statusName ?? "Готовится к отправке"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{order.delivery.mode === "pvz" ? "Пункт выдачи" : "Адрес"}</dt>
          <dd className="max-w-[60%] text-right text-muted">{order.delivery.city}, {order.delivery.address}</dd>
        </div>
      </dl>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {order.items.map((item) => (
          <li key={`${item.productId}-${item.variantId}`}>{item.title} · {item.sizeEu} × {item.quantity}</li>
        ))}
      </ul>

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      {(shipment || cancellable) && status !== "cancelled" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {shipment && (
            <>
              <button type="button" className={button} onClick={() => openLabel(false)}><Eye className="h-4 w-4" strokeWidth={1.6} /> Этикетка</button>
              <button type="button" className={button} onClick={() => openLabel(true)}><Download className="h-4 w-4" strokeWidth={1.6} /> Скачать</button>
            </>
          )}
          {cancellable && (
            <button type="button" className={button} disabled={cancelling} onClick={() => setConfirmOpen(true)}>
              <X className="h-4 w-4" strokeWidth={1.6} /> Отменить заказ
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Отменить заказ?"
        description={`Заказ ${order.number} будет отменён. Вернуть его будет нельзя — придётся оформлять заново.`}
        confirmLabel={cancelling ? "Отменяем…" : "Да, отменить"}
        cancelLabel="Нет, оставить"
        pending={cancelling}
        onConfirm={handleCancel}
        onClose={() => setConfirmOpen(false)}
      />
    </article>
  );
}
