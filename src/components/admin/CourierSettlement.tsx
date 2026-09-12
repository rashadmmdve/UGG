import Link from "next/link";

import { paymentLabel } from "@/lib/payment-kind";
import { formatPrice } from "@/lib/utils";
import type { Courier } from "@/server/repositories/couriers";
import type { Order } from "@/lib/types";

/**
 * Расчёт с курьером за период.
 *
 * Курьеру платят за отвезённое, а с него спрашивают наличные, которые
 * он собрал: поэтому здесь два числа отдельно — сколько у него на руках
 * наличными и сколько ушло картой мимо него. Считаются только вручённые
 * заказы по дате вручения, а не оформления: заказ мог лежать неделю.
 */
export function CourierSettlement({
  couriers,
  courierId,
  from,
  to,
  orders,
}: {
  couriers: Courier[];
  courierId: string;
  from: string;
  to: string;
  /** Уже отобранные: этого курьера, вручённые, в периоде. */
  orders: Order[];
}) {
  const cash = orders.filter((order) => order.paymentMethod === "on_delivery");
  const card = orders.filter((order) => order.paymentMethod === "online");
  const sum = (list: Order[]) => list.reduce((total, order) => total + order.total, 0);

  const field =
    "h-9 rounded border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-accent";
  const stat = "rounded-lg border border-line bg-bg p-4";

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Курьеры</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Сколько отвёз и сколько денег собрал — чтобы рассчитаться. Наличные у
        курьера на руках, картой — прошло мимо него. Считается по дате вручения.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="period" value="all" />
        <label className="flex flex-col gap-1 text-xs text-muted">
          Курьер
          <select name="courier" defaultValue={courierId} className={`${field} min-w-48`}>
            <option value="">Выберите…</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
                {courier.isActive ? "" : " (не работает)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          С
          <input type="date" name="from" defaultValue={from} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          По
          <input type="date" name="to" defaultValue={to} className={field} />
        </label>
        <button type="submit" className="h-9 rounded border border-line px-4 text-sm hover:border-accent">
          Показать
        </button>
      </form>

      {!courierId ? (
        <p className="mt-4 text-sm text-muted">Выберите курьера и период.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={stat}>
              <p className="label-caps">Отвёз</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{orders.length}</p>
              <p className="text-xs text-muted">заказов</p>
            </div>
            <div className={stat}>
              <p className="label-caps">Наличными</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(sum(cash))}</p>
              <p className="text-xs text-muted">{cash.length} заказов · у курьера на руках</p>
            </div>
            <div className={stat}>
              <p className="label-caps">Картой</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(sum(card))}</p>
              <p className="text-xs text-muted">{card.length} заказов · мимо курьера</p>
            </div>
            <div className={stat}>
              <p className="label-caps">Всего</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(sum(orders))}</p>
              <p className="text-xs text-muted">за период</p>
            </div>
          </div>

          {orders.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-bg">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-normal">Вручён</th>
                    <th className="px-4 py-2 font-normal">Заказ</th>
                    <th className="px-4 py-2 font-normal">Покупатель</th>
                    <th className="px-4 py-2 font-normal">Оплата</th>
                    <th className="px-4 py-2 text-right font-normal">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-2 text-muted">
                        {order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString("ru-RU") : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/orders/${order.id}`} className="font-mono hover:text-accent">
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-muted">{order.customer.name}</td>
                      <td className="px-4 py-2">{paymentLabel(order)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatPrice(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
