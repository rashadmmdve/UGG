"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatPrice, sizeLabel } from "@/lib/utils";
import { assignCourierAction } from "@/server/admin/actions/couriers";
import { dispatchNowAction, setDailyDispatchAction } from "@/server/admin/actions/dispatch";
import { cancelOrderAction } from "@/server/admin/actions/orders";
import type { Courier } from "@/server/repositories/couriers";
import type { Order } from "@/lib/types";

/**
 * Стол оператора: новые заказы своей доставки — раздать или отменить.
 *
 * Каждая строка решается на месте: выбрал курьера — заказ подтверждён и
 * закреплён за ним; нажал «Отменить» — обязательная причина, и заказ
 * закрыт с ней. Ходить в карточку заказа ради этого не нужно.
 *
 * В Телеграм ничего не уходит само: курьеры получают списки по кнопке
 * «Отправить сейчас» или утром — если включена галочка.
 *
 * Строка после решения исчезает: список — это то, что ещё не решено.
 */
export function DispatchBoard({
  orders,
  couriers,
  daily,
}: {
  orders: Order[];
  couriers: Courier[];
  /** Включена ли утренняя рассылка — галочка рядом с кнопкой. */
  daily: boolean;
}) {
  const [rows, setRows] = useState(orders);
  const [dailyOn, setDailyOn] = useState(daily);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function assign(order: Order, courierId: string) {
    if (!courierId) return;
    startTransition(async () => {
      const result = await assignCourierAction(order.id, courierId);
      if (result.ok) {
        setRows((current) => current.filter((item) => item.id !== order.id));
        const courier = couriers.find((item) => item.id === courierId);
        setMessage({ success: `${order.number} → ${courier?.name ?? "курьер"}: подтверждён` });
      } else {
        setMessage({ error: result.error });
      }
    });
  }

  function cancel() {
    if (!cancelling) return;
    const order = cancelling;
    startTransition(async () => {
      const result = await cancelOrderAction(order.id, reason);
      setCancelling(null);
      setReason("");
      if (result.ok) {
        setRows((current) => current.filter((item) => item.id !== order.id));
        setMessage({ success: `${order.number} отменён` });
      } else {
        setMessage({ error: result.error });
      }
    });
  }

  function dispatchNow() {
    startTransition(async () => {
      const result = await dispatchNowAction();
      setMessage(
        result.ok
          ? {
              success: `Разослано: ${result.result.couriers} курьерам, ${result.result.orders} заказов` +
                (result.result.unassigned ? `, без курьера ${result.result.unassigned}` : ""),
            }
          : { error: result.error },
      );
    });
  }

  function toggleDaily(next: boolean) {
    setDailyOn(next);
    startTransition(async () => {
      const result = await setDailyDispatchAction(next);
      if (!result.ok) {
        setDailyOn(!next);
        setMessage({ error: "Не удалось сохранить настройку" });
      }
    });
  }

  const select =
    "h-9 rounded border border-line bg-bg px-2 text-sm text-fg outline-none focus:border-accent disabled:opacity-60";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-bg px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dailyOn}
            disabled={pending}
            onChange={(event) => toggleDaily(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Отправлять списки курьерам каждое утро в 9:00
        </label>
        <button
          type="button"
          onClick={dispatchNow}
          disabled={pending}
          className="h-9 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Отправить сейчас
        </button>
        <span className="text-xs text-muted">
          Курьеры получают заказы только так — по кнопке или утром, если включено.
        </span>
      </div>
      <div className="mt-3">
        <FormMessage error={message.error} success={message.success} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Нераспределённых заказов нет — всё роздано.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Заказ</th>
                <th className="px-4 py-2 font-normal">Покупатель</th>
                <th className="px-4 py-2 font-normal">Куда</th>
                <th className="px-4 py-2 font-normal">Состав</th>
                <th className="px-4 py-2 text-right font-normal">Сумма</th>
                <th className="px-4 py-2 font-normal">Курьер</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((order) => (
                <tr key={order.id} className="align-top hover:bg-sand">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono font-semibold hover:text-accent">
                      {order.number}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted">
                      {new Date(order.createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.customer.name}
                    <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, "")}`} className="block text-xs text-muted hover:text-accent">
                      {order.customer.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {order.delivery.city}
                    {order.delivery.mode === "courier" ? `, ${order.delivery.address}` : " — адрес уточнить"}
                    {order.comment && <span className="mt-1 block text-xs">💬 {order.comment}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {order.items.map((item) => (
                      <span key={`${item.productId}-${item.variantId}`} className="block">
                        {item.title}
                        {sizeLabel(item.sizeEu) ? `, ${item.sizeEu}` : ""}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatPrice(order.total)}
                    <span className="block text-xs text-muted">
                      {order.paymentStatus === "paid" ? "оплачен" : order.paymentMethod === "online" ? "ждёт оплаты" : "наличными"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      defaultValue=""
                      disabled={pending}
                      onChange={(event) => assign(order, event.target.value)}
                      aria-label={`Курьер для ${order.number}`}
                      className={select}
                    >
                      <option value="">Выбрать…</option>
                      {couriers.map((courier) => (
                        <option key={courier.id} value={courier.id}>{courier.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setCancelling(order)}
                      disabled={pending}
                      className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/5 disabled:opacity-60"
                    >
                      Отменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelling)}
        title={`Отменить заказ ${cancelling?.number ?? ""}?`}
        description="Товары вернутся в каталог, покупатель узнает из письма. Причина сохранится в заказе."
        confirmLabel="Отменить заказ"
        cancelLabel="Не отменять"
        pending={pending}
        disabled={!reason.trim()}
        onConfirm={cancel}
        onClose={() => {
          setCancelling(null);
          setReason("");
        }}
      >
        <label className="block text-xs font-medium text-muted">
          Причина отмены
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Покупатель передумал, не дозвонились, нет размера…"
            className="mt-1 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
