import Link from "next/link";

import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { getOrders } from "@/server/repositories/orders";
import type { OrderStatus } from "@/lib/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-accent-soft text-accent",
  confirmed: "bg-elevated text-fg",
  shipped: "bg-elevated text-fg",
  completed: "bg-success/10 text-success",
  cancelled: "bg-elevated text-muted",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  const { status } = await props.searchParams;
  const filter = typeof status === "string" ? status : "";

  const all = getOrders();
  const orders = filter ? all.filter((order) => order.status === filter) : all;

  const counts = all.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Заказы <span className="text-base font-normal text-muted">{orders.length}</span>
      </h1>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/orders"
          className={`rounded-full border px-3 py-1 ${!filter ? "border-accent text-accent" : "border-line hover:border-accent"}`}
        >
          Все · {all.length}
        </Link>
        {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((key) => (
          <Link
            key={key}
            href={`/admin/orders?status=${key}`}
            className={`rounded-full border px-3 py-1 ${filter === key ? "border-accent text-accent" : "border-line hover:border-accent"}`}
          >
            {ORDER_STATUS_LABELS[key]} · {counts[key] ?? 0}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Заказов нет.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Номер</th>
                <th className="px-4 py-2 font-normal">Дата</th>
                <th className="px-4 py-2 font-normal">Покупатель</th>
                <th className="px-4 py-2 font-normal">Доставка</th>
                <th className="px-4 py-2 font-normal text-right">Сумма</th>
                <th className="px-4 py-2 font-normal">Оплата</th>
                <th className="px-4 py-2 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-sand">
                  <td className="px-4 py-2">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono font-medium hover:text-accent">
                      {order.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-2">
                    {order.customer.name}
                    <span className="block text-xs text-muted">{order.customer.phone}</span>
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {order.delivery.city}
                    <span className="block text-xs">
                      {order.delivery.mode === "pvz" ? "ПВЗ" : "курьер"}
                      {order.cdek?.cdekNumber && ` · ${order.cdek.cdekNumber}`}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatPrice(order.total)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs ${order.paymentStatus === "paid" ? "text-success" : "text-muted"}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
