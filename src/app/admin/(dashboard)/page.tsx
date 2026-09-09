import Link from "next/link";

import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatPrice, plural } from "@/lib/utils";
import { getProducts } from "@/server/repositories/catalog";
import { getOrders } from "@/server/repositories/orders";
import { getPendingReviews } from "@/server/repositories/reviews";
import { getUsers } from "@/server/repositories/users";

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-bg p-4 transition hover:border-accent"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-line bg-bg p-4">{body}</div>
  );
}

export default function AdminDashboardPage() {
  const orders = getOrders();
  const products = getProducts();
  const pendingReviews = getPendingReviews();
  const customers = getUsers().filter((user) => user.role === "customer");

  const newOrders = orders.filter((order) => order.status === "new");
  const revenue = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);

  /** Товары, у которых кончились все размеры, — их либо пополнять, либо снимать. */
  const outOfStock = products.filter(
    (product) =>
      product.isPublished &&
      product.variants.every((variant) => variant.stock === 0),
  );

  const unpublished = products.filter((product) => !product.isPublished);

  return (
    <div>
      <h1 className="text-2xl font-bold">Обзор</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Новых заказов" value={newOrders.length} href="/admin/orders" />
        <Stat label="Всего заказов" value={orders.length} href="/admin/orders" />
        <Stat label="Выручка" value={formatPrice(revenue)} />
        <Stat label="Клиентов" value={customers.length} href="/admin/customers" />
        <Stat label="Товаров" value={products.length} href="/admin/products" />
        <Stat label="Не опубликовано" value={unpublished.length} href="/admin/products" />
        <Stat label="Нет в наличии" value={outOfStock.length} />
        <Stat
          label="Отзывов на модерации"
          value={pendingReviews.length}
          href="/admin/reviews"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-bg p-5">
          <h2 className="font-semibold">Последние заказы</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Заказов пока нет.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {orders.slice(0, 8).map((order) => (
                <li key={order.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {order.number}
                  </Link>
                  <span className="text-muted">{order.customer.name}</span>
                  <span className="text-muted">{ORDER_STATUS_LABELS[order.status]}</span>
                  <span className="font-medium">{formatPrice(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line bg-bg p-5">
          <h2 className="font-semibold">
            Закончились{" "}
            <span className="text-muted">
              — {outOfStock.length}{" "}
              {plural(outOfStock.length, ["товар", "товара", "товаров"])}
            </span>
          </h2>
          {outOfStock.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Все опубликованные товары в наличии.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {outOfStock.slice(0, 8).map((product) => (
                <li key={product.id} className="py-2">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="hover:text-accent"
                  >
                    {product.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
